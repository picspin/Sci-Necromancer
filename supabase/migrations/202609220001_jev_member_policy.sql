-- Server-only Jev consent, short-lived analysis reservations, and per-member cache.
-- Manual PostgreSQL verification required before release (not replaced by static tests):
-- 1. Run 31 concurrent jev_reserve_analysis calls for one consented profile; assert <=30 inserts.
-- 2. Run four parallel calls in one minute; assert only three reservations and DB retry_at.
-- 3. Settle one reservation failed, then reserve again; assert daily capacity is not consumed but minute count is.
-- 4. Reserve the same key in parallel; assert one pending row and all other calls return that id as pending.
-- 5. Advance a lease then settle; assert returned expired outcome and persisted failed status.
-- 6. Race consent=false with settlement; assert no cache row is published after revocation.
create table public.member_jev_consents (
  user_id uuid primary key references auth.users(id) on delete cascade,
  version text not null,
  accepted boolean not null,
  updated_at timestamptz not null default now()
);
create table public.member_jev_analysis_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  cache_key text not null check (cache_key ~ '^[a-f0-9]{64}$'),
  status text not null check (status in ('pending', 'completed', 'failed')),
  created_at timestamptz not null default now(),
  lease_expires_at timestamptz not null
);
create table public.member_jev_analysis_cache (
  user_id uuid not null references auth.users(id) on delete cascade,
  cache_key text not null check (cache_key ~ '^[a-f0-9]{64}$'),
  result jsonb not null check (jsonb_typeof(result) = 'object'),
  expires_at timestamptz not null,
  primary key (user_id, cache_key)
);
create index member_jev_attempts_user_created_idx on public.member_jev_analysis_attempts(user_id, created_at);
create index member_jev_attempts_user_key_status_idx on public.member_jev_analysis_attempts(user_id, cache_key, status);
create index member_jev_cache_expiry_idx on public.member_jev_analysis_cache(user_id, expires_at);
alter table public.member_jev_consents enable row level security;
alter table public.member_jev_analysis_attempts enable row level security;
alter table public.member_jev_analysis_cache enable row level security;
revoke all on table public.member_jev_consents, public.member_jev_analysis_attempts, public.member_jev_analysis_cache from public, anon, authenticated;
grant all on table public.member_jev_consents, public.member_jev_analysis_attempts, public.member_jev_analysis_cache to service_role;

create or replace function public.jev_get_consent(p_user_id uuid) returns jsonb language plpgsql security definer set search_path = public as $$
declare v public.member_jev_consents%rowtype;
begin
  perform 1 from public.member_profiles where user_id = p_user_id for update;
  if not found then raise exception 'jev_member_not_found'; end if;
  select * into v from public.member_jev_consents where user_id = p_user_id;
  return jsonb_build_object('accepted', coalesce(v.accepted, false), 'version', coalesce(v.version, 'typesafe-member-2026-09-21-v1'));
end $$;

create or replace function public.jev_set_consent(p_user_id uuid, p_version text, p_accepted boolean) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_now timestamptz;
begin
  perform 1 from public.member_profiles where user_id = p_user_id for update;
  if not found then raise exception 'jev_member_not_found'; end if;
  v_now := clock_timestamp();
  if p_version is null or p_version <> 'typesafe-member-2026-09-21-v1' or p_accepted is null then raise exception 'invalid_jev_consent'; end if;
  insert into public.member_jev_consents(user_id, version, accepted, updated_at) values(p_user_id,p_version,p_accepted,v_now)
  on conflict(user_id) do update set version=excluded.version, accepted=excluded.accepted, updated_at=excluded.updated_at;
  if not p_accepted then
    delete from public.member_jev_analysis_cache where user_id=p_user_id;
    update public.member_jev_analysis_attempts set status='failed' where user_id=p_user_id and status='pending';
  end if;
  return jsonb_build_object('accepted', p_accepted, 'version', p_version);
end $$;

create or replace function public.jev_reserve_analysis(p_user_id uuid, p_version text, p_cache_key text) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_now timestamptz; v_balance integer; v_cached jsonb; v_active uuid; v_minute integer; v_day integer; v_retry timestamptz; v_id uuid;
begin
  perform 1 from public.member_profiles where user_id=p_user_id for update;
  if not found then raise exception 'jev_member_not_found'; end if;
  v_now:=clock_timestamp();
  if p_version is null or p_cache_key is null or p_version <> 'typesafe-member-2026-09-21-v1' or p_cache_key !~ '^[a-f0-9]{64}$' then raise exception 'invalid_jev_cache_key'; end if;
  if not exists(select 1 from public.member_jev_consents where user_id=p_user_id and version=p_version and accepted) then raise exception 'jev_consent_required'; end if;
  select bonus_balance into v_balance from public.member_profiles where user_id=p_user_id;
  if coalesce(v_balance,0)<=0 then raise exception 'insufficient_bonus'; end if;
  update public.member_jev_analysis_attempts set status='failed' where user_id=p_user_id and status='pending' and lease_expires_at<=v_now;
  delete from public.member_jev_analysis_cache where user_id=p_user_id and expires_at<=v_now;
  select result into v_cached from public.member_jev_analysis_cache where user_id=p_user_id and cache_key=p_cache_key and expires_at>v_now;
  select count(*) into v_day from public.member_jev_analysis_attempts where user_id=p_user_id and created_at>v_now-interval '24 hours' and status in ('pending','completed');
  if v_cached is not null then return jsonb_build_object('status','cached','result',v_cached,'remaining',greatest(30-v_day,0)); end if;
  select id into v_active from public.member_jev_analysis_attempts where user_id=p_user_id and cache_key=p_cache_key and status='pending' and lease_expires_at>v_now order by created_at desc limit 1;
  if v_active is not null then return jsonb_build_object('status','pending','reservation_id',v_active,'remaining',greatest(30-v_day,0)); end if;
  select count(*) into v_minute from public.member_jev_analysis_attempts where user_id=p_user_id and created_at>v_now-interval '1 minute';
  if v_minute>=3 or v_day>=30 then
    select max(x) into v_retry from (values (
      case when v_minute>=3 then (select min(created_at)+interval '1 minute' from public.member_jev_analysis_attempts where user_id=p_user_id and created_at>v_now-interval '1 minute') end),
      case when v_day>=30 then (select min(least(created_at+interval '24 hours', case when status='pending' then lease_expires_at else created_at+interval '24 hours' end)) from public.member_jev_analysis_attempts where user_id=p_user_id and created_at>v_now-interval '24 hours' and status in ('pending','completed')) end)
    ) as retries(x);
    return jsonb_build_object('status','limited','retry_at',v_retry,'remaining',greatest(30-v_day,0));
  end if;
  insert into public.member_jev_analysis_attempts(user_id,cache_key,status,created_at,lease_expires_at) values(p_user_id,p_cache_key,'pending',v_now,v_now+interval '120 seconds') returning id into v_id;
  return jsonb_build_object('status','reserved','reservation_id',v_id,'remaining',greatest(29-v_day,0));
end $$;

create or replace function public.jev_settle_analysis(p_user_id uuid, p_reservation_id uuid, p_success boolean, p_result jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_now timestamptz; v public.member_jev_analysis_attempts%rowtype;
begin
  perform 1 from public.member_profiles where user_id=p_user_id for update;
  if not found then raise exception 'jev_member_not_found'; end if;
  v_now:=clock_timestamp();
  select * into v from public.member_jev_analysis_attempts where id=p_reservation_id and user_id=p_user_id for update;
  if not found then raise exception 'jev_reservation_not_found'; end if;
  if v.status <> 'pending' then
    if (v.status='completed') = p_success then return jsonb_build_object('status','settled'); end if;
    return jsonb_build_object('status','conflict');
  end if;
  if v.lease_expires_at<=v_now then update public.member_jev_analysis_attempts set status='failed' where id=v.id; return jsonb_build_object('status','expired'); end if;
  if p_success is null then raise exception 'invalid_jev_result'; end if;
  if p_success then
    if p_result is null or jsonb_typeof(p_result)<>'object' or octet_length(convert_to(p_result::text,'utf8'))>65536
       or (p_result - array['analysis','preflight','provider','model','policyVersion']) <> '{}'::jsonb
       or not (p_result ?& array['analysis','preflight','provider','model','policyVersion'])
       or jsonb_typeof(p_result->'analysis')<>'object' or (p_result->'analysis' - array['categories','keywords']) <> '{}'::jsonb
       or not (p_result->'analysis' ?& array['categories','keywords'])
       or jsonb_typeof(p_result->'preflight')<>'object'
       or p_result ?| array['sourceText','source_text','prompt','evidence','manuscript','text']
       or p_result->'analysis' ?| array['sourceText','source_text','prompt','evidence','manuscript','text']
       or p_result->'preflight' ?| array['sourceText','source_text','prompt','evidence','manuscript','text']
       or p_result->>'provider' <> 'typesafe' or coalesce(length(p_result->>'model'),0)=0 or p_result->>'policyVersion' <> 'jev-analysis-v1'
    then raise exception 'invalid_jev_result'; end if;
    if not exists(select 1 from public.member_jev_consents where user_id=p_user_id and version='typesafe-member-2026-09-21-v1' and accepted) then raise exception 'jev_consent_required'; end if;
    insert into public.member_jev_analysis_cache(user_id,cache_key,result,expires_at) values(p_user_id,v.cache_key,p_result,v_now+interval '24 hours') on conflict(user_id,cache_key) do update set result=excluded.result,expires_at=excluded.expires_at;
    update public.member_jev_analysis_attempts set status='completed' where id=v.id;
  else
    if p_result is not null then raise exception 'invalid_jev_result'; end if;
    update public.member_jev_analysis_attempts set status='failed' where id=v.id;
  end if;
  return jsonb_build_object('status','settled');
end $$;

create or replace function public.jev_prune_expired_analysis() returns void language plpgsql security definer set search_path = public as $$ declare v_profile uuid; v_now timestamptz; begin
  -- Match settlement's profile-first lock order so maintenance cannot deadlock it.
  for v_profile in
    select user_id from (
      select user_id from public.member_jev_analysis_attempts where status='pending' or created_at<clock_timestamp()-interval '48 hours'
      union select user_id from public.member_jev_analysis_cache where expires_at<=clock_timestamp()
    ) affected order by user_id
  loop
    perform 1 from public.member_profiles where user_id=v_profile for update;
    v_now:=clock_timestamp();
    delete from public.member_jev_analysis_cache where user_id=v_profile and expires_at<=v_now;
    update public.member_jev_analysis_attempts set status='failed' where user_id=v_profile and status='pending' and lease_expires_at<=v_now;
    delete from public.member_jev_analysis_attempts where user_id=v_profile and created_at<v_now-interval '48 hours';
  end loop;
end $$;

revoke all on function public.jev_get_consent(uuid), public.jev_set_consent(uuid,text,boolean), public.jev_reserve_analysis(uuid,text,text), public.jev_settle_analysis(uuid,uuid,boolean,jsonb), public.jev_prune_expired_analysis() from public, anon, authenticated;
grant execute on function public.jev_get_consent(uuid), public.jev_set_consent(uuid,text,boolean), public.jev_reserve_analysis(uuid,text,text), public.jev_settle_analysis(uuid,uuid,boolean,jsonb), public.jev_prune_expired_analysis() to service_role;
