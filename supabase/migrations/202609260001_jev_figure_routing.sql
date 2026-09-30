-- Metadata-only Jev figure-routing quota/cache. No source rows or prompts are stored.
-- Before enabling either figure flag, apply this migration and test concurrent reservations in PostgreSQL.
create table public.member_jev_figure_routes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('data-template', 'illustration-category', 'illustration-journal', 'illustration-prompt', 'illustration-retry')),
  cache_key text not null check (cache_key ~ '^[a-f0-9]{64}$'),
  status text not null check (status in ('pending', 'completed', 'failed')),
  result jsonb,
  created_at timestamptz not null default now(),
  lease_expires_at timestamptz not null
);
create index member_jev_figure_routes_user_created_idx on public.member_jev_figure_routes(user_id, created_at);
create index member_jev_figure_routes_user_key_idx on public.member_jev_figure_routes(user_id, kind, cache_key, status);
alter table public.member_jev_figure_routes enable row level security;
revoke all on table public.member_jev_figure_routes from public, anon, authenticated;
grant all on table public.member_jev_figure_routes to service_role;

create or replace function public.jev_reserve_figure_route(
  p_user_id uuid, p_version text, p_kind text, p_cache_key text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_now timestamptz; v_balance integer; v_day integer; v_minute integer;
        v_cached jsonb; v_pending uuid; v_id uuid;
begin
  perform 1 from public.member_profiles where user_id=p_user_id for update;
  if not found then raise exception 'jev_member_not_found'; end if;
  if p_version <> 'typesafe-member-2026-09-21-v1' or p_kind not in ('data-template','illustration-category','illustration-journal','illustration-prompt','illustration-retry')
     or p_cache_key !~ '^[a-f0-9]{64}$' or p_version is null or p_kind is null or p_cache_key is null
  then raise exception 'invalid_jev_figure_route'; end if;
  if not exists(select 1 from public.member_jev_consents where user_id=p_user_id and version=p_version and accepted)
  then raise exception 'jev_consent_required'; end if;
  select bonus_balance into v_balance from public.member_profiles where user_id=p_user_id;
  if coalesce(v_balance,0)<=0 then raise exception 'insufficient_bonus'; end if;
  v_now:=clock_timestamp();
  update public.member_jev_figure_routes set status='failed', result=null
    where user_id=p_user_id and status='pending' and lease_expires_at<=v_now;
  delete from public.member_jev_figure_routes where user_id=p_user_id and created_at<v_now-interval '48 hours';
  select result into v_cached from public.member_jev_figure_routes
    where user_id=p_user_id and kind=p_kind and cache_key=p_cache_key
      and status='completed' and created_at>v_now-interval '24 hours'
    order by created_at desc limit 1;
  select count(*) into v_day from public.member_jev_figure_routes
    where user_id=p_user_id and created_at>v_now-interval '24 hours' and status in ('pending','completed');
  if v_cached is not null then
    return jsonb_build_object('status','cached','result',v_cached,'remaining',greatest(30-v_day,0));
  end if;
  select id into v_pending from public.member_jev_figure_routes
    where user_id=p_user_id and kind=p_kind and cache_key=p_cache_key and status='pending'
      and lease_expires_at>v_now order by created_at desc limit 1;
  if v_pending is not null then
    return jsonb_build_object('status','pending','remaining',greatest(30-v_day,0));
  end if;
  select count(*) into v_minute from public.member_jev_figure_routes
    where user_id=p_user_id and created_at>v_now-interval '1 minute';
  if v_minute>=3 or v_day>=30 then
    return jsonb_build_object('status','limited','remaining',greatest(30-v_day,0));
  end if;
  insert into public.member_jev_figure_routes(user_id,kind,cache_key,status,created_at,lease_expires_at)
    values(p_user_id,p_kind,p_cache_key,'pending',v_now,v_now+interval '60 seconds') returning id into v_id;
  return jsonb_build_object('status','reserved','reservation_id',v_id,'remaining',greatest(29-v_day,0));
end $$;

create or replace function public.jev_settle_figure_route(
  p_user_id uuid, p_reservation_id uuid, p_success boolean, p_result jsonb
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_now timestamptz; v public.member_jev_figure_routes%rowtype;
begin
  perform 1 from public.member_profiles where user_id=p_user_id for update;
  if not found then raise exception 'jev_member_not_found'; end if;
  v_now:=clock_timestamp();
  select * into v from public.member_jev_figure_routes where id=p_reservation_id and user_id=p_user_id for update;
  if not found then raise exception 'jev_reservation_not_found'; end if;
  if v.status <> 'pending' then
    if (v.status='completed')=p_success then return jsonb_build_object('status','settled'); end if;
    return jsonb_build_object('status','conflict');
  end if;
  if v.lease_expires_at<=v_now then
    update public.member_jev_figure_routes set status='failed' where id=v.id;
    return jsonb_build_object('status','expired');
  end if;
  if p_success is null then raise exception 'invalid_jev_figure_result'; end if;
  if p_success then
    if p_result is null or jsonb_typeof(p_result)<>'object'
      or octet_length(convert_to(p_result::text,'utf8'))>4096
      or p_result->>'kind' is distinct from v.kind
      or jsonb_typeof(p_result->'decision') is distinct from 'object'
      or p_result->'decision'->>'provider' is distinct from 'typesafe'
      or p_result->'decision'->>'model' is distinct from 'jev-1.13.0'
      or p_result->'decision'->>'policyVersion' is distinct from 'jev-figure-routing-v1'
      or p_result ?| array['sourceText','prompt','patientRows','rawData']
    then raise exception 'invalid_jev_figure_result'; end if;
    if not exists(select 1 from public.member_jev_consents
      where user_id=p_user_id and version='typesafe-member-2026-09-21-v1' and accepted)
    then raise exception 'jev_consent_required'; end if;
    update public.member_jev_figure_routes set status='completed', result=p_result where id=v.id;
  else
    if p_result is not null then raise exception 'invalid_jev_figure_result'; end if;
    update public.member_jev_figure_routes set status='failed', result=null where id=v.id;
  end if;
  return jsonb_build_object('status','settled');
end $$;

create or replace function public.jev_clear_figure_routes_on_revoke()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not new.accepted then
    delete from public.member_jev_figure_routes where user_id=new.user_id;
  end if;
  return new;
end $$;
create trigger jev_clear_figure_routes_on_revoke
  after insert or update of accepted on public.member_jev_consents
  for each row execute function public.jev_clear_figure_routes_on_revoke();

revoke all on function public.jev_reserve_figure_route(uuid,text,text,text),
  public.jev_settle_figure_route(uuid,uuid,boolean,jsonb),
  public.jev_clear_figure_routes_on_revoke() from public, anon, authenticated;
grant execute on function public.jev_reserve_figure_route(uuid,text,text,text),
  public.jev_settle_figure_route(uuid,uuid,boolean,jsonb) to service_role;
