create extension if not exists pgcrypto;

create table if not exists public.member_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  bonus_balance integer not null default 0,
  signup_bonus_claimed_at timestamptz,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bonus_ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  idempotency_key text not null,
  delta integer not null,
  reason text not null check (reason in (
    'signup', 'daily_checkin', 'task_reservation', 'task_refund',
    'stripe_purchase', 'stripe_refund', 'stripe_dispute', 'stripe_reinstatement'
  )),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);

create table if not exists public.managed_generation_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  idempotency_key text not null,
  task_kind text not null check (task_kind in (
    'analysis_generation', 'regeneration', 'deep_update', 'image_generation'
  )),
  status text not null default 'reserved' check (status in ('reserved', 'completed', 'refunded')),
  cost integer not null default 1 check (cost = 1),
  call_count integer not null default 1 check (call_count between 1 and 4),
  current_stage integer not null default 4 check (current_stage between 1 and 4),
  in_flight boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  settled_at timestamptz,
  unique (user_id, idempotency_key)
);

create table if not exists public.member_daily_checkins (
  user_id uuid not null references auth.users(id) on delete cascade,
  checkin_date date not null,
  created_at timestamptz not null default now(),
  primary key (user_id, checkin_date)
);

create table if not exists public.member_abstracts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null,
  title text not null default '',
  conference text not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, client_id)
);

alter table public.member_profiles enable row level security;
alter table public.bonus_ledger enable row level security;
alter table public.managed_generation_tasks enable row level security;
alter table public.member_daily_checkins enable row level security;
alter table public.member_abstracts enable row level security;

create policy "members read own profile" on public.member_profiles
  for select using (auth.uid() = user_id);
create policy "members read own ledger" on public.bonus_ledger
  for select using (auth.uid() = user_id);
create policy "members read own tasks" on public.managed_generation_tasks
  for select using (auth.uid() = user_id);
create policy "members read own checkins" on public.member_daily_checkins
  for select using (auth.uid() = user_id);
create policy "members read own abstracts" on public.member_abstracts
  for select using (auth.uid() = user_id);

create or replace function public.create_member_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.member_profiles (user_id) values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_member_profile on auth.users;
create trigger on_auth_user_created_member_profile
  after insert on auth.users
  for each row execute function public.create_member_profile();

create or replace function public.admin_claim_signup_bonus(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  inserted_count integer;
  balance integer;
begin
  if not exists (
    select 1 from auth.users where id = p_user_id and email_confirmed_at is not null
  ) then
    raise exception 'verified_email_required';
  end if;

  insert into public.member_profiles (user_id) values (p_user_id)
  on conflict (user_id) do nothing;

  insert into public.bonus_ledger (user_id, idempotency_key, delta, reason)
  values (p_user_id, 'signup', 5, 'signup')
  on conflict (user_id, idempotency_key) do nothing;
  get diagnostics inserted_count = row_count;

  if inserted_count = 1 then
    update public.member_profiles
      set bonus_balance = bonus_balance + 5,
          signup_bonus_claimed_at = now(),
          updated_at = now()
      where user_id = p_user_id;
  end if;

  select bonus_balance into balance from public.member_profiles where user_id = p_user_id;
  return jsonb_build_object('bonus_balance', balance, 'awarded', inserted_count = 1);
end;
$$;

create or replace function public.recover_stale_tasks(p_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  stale_task public.managed_generation_tasks%rowtype;
  recovered integer := 0;
begin
  perform 1 from public.member_profiles where user_id = p_user_id for update;
  for stale_task in
    select * from public.managed_generation_tasks
    where user_id = p_user_id
      and status = 'reserved'
      and in_flight
      and updated_at < now() - interval '150 seconds'
    for update
  loop
    update public.managed_generation_tasks
      set status = 'refunded', in_flight = false, settled_at = now(), updated_at = now()
      where id = stale_task.id;
    update public.member_profiles
      set bonus_balance = bonus_balance + 1, updated_at = now()
      where user_id = p_user_id;
    insert into public.bonus_ledger (user_id, idempotency_key, delta, reason, metadata)
      values (
        p_user_id, 'task:stale-refund:' || stale_task.id::text, 1, 'task_refund',
        jsonb_build_object('task_id', stale_task.id, 'recovered', true)
      ) on conflict (user_id, idempotency_key) do nothing;
    recovered := recovered + 1;
  end loop;
  return recovered;
end;
$$;

create or replace function public.member_status(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  profile public.member_profiles%rowtype;
  shanghai_date date := timezone('Asia/Shanghai', now())::date;
begin
  perform public.recover_stale_tasks(p_user_id);
  update public.member_profiles
    set last_seen_at = now(), updated_at = now()
    where user_id = p_user_id
    returning * into profile;

  if profile.user_id is null then raise exception 'member_not_found'; end if;

  return jsonb_build_object(
    'bonus_balance', profile.bonus_balance,
    'checked_in_today', exists (
      select 1 from public.member_daily_checkins
      where user_id = p_user_id and checkin_date = shanghai_date
    ),
    'last_seen_at', profile.last_seen_at,
    'signup_bonus_claimed', profile.signup_bonus_claimed_at is not null
  );
end;
$$;

create or replace function public.check_in_bonus(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  shanghai_date date := timezone('Asia/Shanghai', now())::date;
  inserted_count integer;
  profile public.member_profiles%rowtype;
begin
  insert into public.member_daily_checkins (user_id, checkin_date)
  values (p_user_id, shanghai_date)
  on conflict (user_id, checkin_date) do nothing;
  get diagnostics inserted_count = row_count;

  if inserted_count = 1 then
    update public.member_profiles
      set bonus_balance = bonus_balance + 1, last_seen_at = now(), updated_at = now()
      where user_id = p_user_id;
    insert into public.bonus_ledger (user_id, idempotency_key, delta, reason)
    values (p_user_id, 'checkin:' || shanghai_date::text, 1, 'daily_checkin');
  end if;

  select * into profile from public.member_profiles where user_id = p_user_id;
  return jsonb_build_object(
    'bonus_balance', profile.bonus_balance,
    'checked_in_today', true,
    'last_seen_at', profile.last_seen_at,
    'awarded', inserted_count = 1
  );
end;
$$;

create or replace function public.reserve_bonus_task(
  p_user_id uuid,
  p_idempotency_key text,
  p_task_kind text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_task public.managed_generation_tasks%rowtype;
  new_task public.managed_generation_tasks%rowtype;
  balance integer;
begin
  if length(p_idempotency_key) < 1 or length(p_idempotency_key) > 128 then
    raise exception 'invalid_idempotency_key';
  end if;
  if p_task_kind not in ('analysis_generation', 'regeneration', 'deep_update', 'image_generation') then
    raise exception 'invalid_task_kind';
  end if;

  perform 1 from public.member_profiles where user_id = p_user_id for update;
  perform public.recover_stale_tasks(p_user_id);

  select * into existing_task from public.managed_generation_tasks
    where user_id = p_user_id and idempotency_key = p_idempotency_key;
  if existing_task.id is not null then
    if existing_task.task_kind <> p_task_kind then raise exception 'idempotency_key_conflict'; end if;
    if existing_task.status = 'refunded' then raise exception 'idempotency_key_refunded'; end if;
    if existing_task.status = 'completed' then raise exception 'workflow_completed'; end if;
    if existing_task.in_flight then raise exception 'workflow_busy'; end if;
    raise exception 'idempotency_key_conflict';
  end if;

  select bonus_balance into balance from public.member_profiles where user_id = p_user_id;
  if balance is null then raise exception 'member_not_found'; end if;
  if balance < 1 then raise exception 'insufficient_bonus'; end if;

  update public.member_profiles
    set bonus_balance = bonus_balance - 1, last_seen_at = now(), updated_at = now()
    where user_id = p_user_id returning bonus_balance into balance;
  insert into public.managed_generation_tasks (
    user_id, idempotency_key, task_kind, current_stage, in_flight
  ) values (
    p_user_id, p_idempotency_key, p_task_kind,
    case when p_task_kind = 'analysis_generation' then 1 else 4 end,
    true
  ) returning * into new_task;
  insert into public.bonus_ledger (user_id, idempotency_key, delta, reason, metadata)
    values (
      p_user_id, 'task:reserve:' || p_idempotency_key, -1, 'task_reservation',
      jsonb_build_object('task_id', new_task.id, 'task_kind', p_task_kind)
    );

  return jsonb_build_object(
    'task_id', new_task.id, 'status', new_task.status,
    'bonus_balance', balance, 'charged', true
  );
end;
$$;

create or replace function public.continue_bonus_task(
  p_user_id uuid,
  p_task_id uuid,
  p_operation text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  task public.managed_generation_tasks%rowtype;
  next_stage integer;
  balance integer;
begin
  next_stage := case p_operation
    when 'synopsis' then 2
    when 'type' then 3
    when 'generation' then 4
    else 0
  end;
  if next_stage = 0 then raise exception 'invalid_workflow_operation'; end if;

  perform 1 from public.member_profiles where user_id = p_user_id for update;
  perform public.recover_stale_tasks(p_user_id);
  select * into task from public.managed_generation_tasks
    where id = p_task_id and user_id = p_user_id for update;

  if task.id is null or task.task_kind <> 'analysis_generation' then
    raise exception 'workflow_not_found';
  end if;
  if task.status = 'refunded' then raise exception 'idempotency_key_refunded'; end if;
  if task.status = 'completed' then raise exception 'workflow_completed'; end if;
  if task.in_flight then raise exception 'workflow_busy'; end if;
  if task.updated_at < now() - interval '30 minutes' then raise exception 'workflow_expired'; end if;
  if next_stage <= task.current_stage then raise exception 'invalid_workflow_transition'; end if;

  update public.managed_generation_tasks
    set current_stage = next_stage,
        call_count = call_count + 1,
        in_flight = true,
        updated_at = now()
    where id = task.id
    returning * into task;
  select bonus_balance into balance from public.member_profiles where user_id = p_user_id;
  return jsonb_build_object(
    'task_id', task.id, 'status', task.status,
    'bonus_balance', balance, 'charged', false
  );
end;
$$;

create or replace function public.settle_bonus_task(
  p_user_id uuid,
  p_task_id uuid,
  p_success boolean,
  p_complete_workflow boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  task public.managed_generation_tasks%rowtype;
  balance integer;
  did_refund boolean := false;
begin
  perform 1 from public.member_profiles where user_id = p_user_id for update;
  select * into task from public.managed_generation_tasks
    where id = p_task_id and user_id = p_user_id for update;
  if task.id is null then raise exception 'task_not_found'; end if;

  if task.status = 'reserved' and p_success then
    update public.managed_generation_tasks
      set status = case when p_complete_workflow then 'completed' else 'reserved' end,
          in_flight = false,
          settled_at = case when p_complete_workflow then now() else settled_at end,
          updated_at = now()
      where id = task.id
      returning * into task;
  elsif task.status = 'reserved' and not p_success then
    update public.managed_generation_tasks
      set status = 'refunded', in_flight = false, settled_at = now(), updated_at = now()
      where id = task.id;
    update public.member_profiles
      set bonus_balance = bonus_balance + 1, updated_at = now() where user_id = p_user_id;
    insert into public.bonus_ledger (user_id, idempotency_key, delta, reason, metadata)
      values (
        p_user_id, 'task:refund:' || task.id::text, 1, 'task_refund',
        jsonb_build_object('task_id', task.id)
      ) on conflict (user_id, idempotency_key) do nothing;
    task.status := 'refunded';
    did_refund := true;
  end if;

  select bonus_balance into balance from public.member_profiles where user_id = p_user_id;
  return jsonb_build_object(
    'task_id', task.id, 'status', task.status,
    'bonus_balance', balance, 'refunded', did_refund
  );
end;
$$;

revoke all on function public.admin_claim_signup_bonus(uuid) from public, anon, authenticated;
revoke all on function public.recover_stale_tasks(uuid) from public, anon, authenticated;
revoke all on function public.member_status(uuid) from public, anon, authenticated;
revoke all on function public.check_in_bonus(uuid) from public, anon, authenticated;
revoke all on function public.reserve_bonus_task(uuid, text, text) from public, anon, authenticated;
revoke all on function public.continue_bonus_task(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.settle_bonus_task(uuid, uuid, boolean, boolean) from public, anon, authenticated;
grant execute on function public.admin_claim_signup_bonus(uuid) to service_role;
grant execute on function public.member_status(uuid) to service_role;
grant execute on function public.check_in_bonus(uuid) to service_role;
grant execute on function public.reserve_bonus_task(uuid, text, text) to service_role;
grant execute on function public.continue_bonus_task(uuid, uuid, text) to service_role;
grant execute on function public.settle_bonus_task(uuid, uuid, boolean, boolean) to service_role;
