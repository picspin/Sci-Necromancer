alter table public.member_profiles
  add column if not exists abstract_quota integer not null default 30;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'member_profiles_abstract_quota_check'
  ) then
    alter table public.member_profiles
      add constraint member_profiles_abstract_quota_check
      check (abstract_quota in (30, 100, 500));
  end if;
end;
$$;

alter table public.managed_generation_tasks
  add column if not exists generation_count integer not null default 0,
  add column if not exists deep_update_count integer not null default 0,
  add column if not exists successful_call_count integer not null default 0,
  add column if not exists in_flight_operation text;

alter table public.managed_generation_tasks
  drop constraint if exists managed_generation_tasks_task_kind_check;
alter table public.managed_generation_tasks
  add constraint managed_generation_tasks_task_kind_check check (task_kind in (
    'analysis_generation', 'regeneration', 'deep_update', 'image_generation', 'blind_review'
  ));

alter table public.bonus_ledger drop constraint if exists bonus_ledger_reason_check;
alter table public.bonus_ledger add constraint bonus_ledger_reason_check check (reason in (
  'signup', 'daily_checkin', 'task_reservation', 'task_refund', 'storage_upgrade',
  'stripe_purchase', 'stripe_refund', 'stripe_dispute', 'stripe_reinstatement'
));

update public.managed_generation_tasks
set generation_count = case
      when task_kind = 'analysis_generation' and current_stage >= 4 then 1
      when task_kind = 'regeneration' then 1
      else generation_count
    end,
    deep_update_count = case when task_kind = 'deep_update' then 1 else deep_update_count end,
    successful_call_count = case when status in ('reserved', 'completed') and not in_flight
      then greatest(successful_call_count, call_count)
      else successful_call_count
    end;

create or replace function public.member_checkin_streak(p_user_id uuid, p_anchor date)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  with recursive consecutive(checkin_date) as (
    select p_anchor
    where exists (
      select 1 from public.member_daily_checkins
      where user_id = p_user_id and checkin_date = p_anchor
    )
    union all
    select consecutive.checkin_date - 1
    from consecutive
    where exists (
      select 1 from public.member_daily_checkins
      where user_id = p_user_id and checkin_date = consecutive.checkin_date - 1
    )
  )
  select count(*)::integer from consecutive;
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
  checked_today boolean;
  streak integer;
  abstract_count integer;
begin
  perform public.recover_stale_tasks(p_user_id);
  update public.member_profiles
    set last_seen_at = now(), updated_at = now()
    where user_id = p_user_id
    returning * into profile;
  if profile.user_id is null then raise exception 'member_not_found'; end if;

  checked_today := exists (
    select 1 from public.member_daily_checkins
    where user_id = p_user_id and checkin_date = shanghai_date
  );
  streak := public.member_checkin_streak(
    p_user_id,
    case when checked_today then shanghai_date else shanghai_date - 1 end
  );
  select count(*)::integer into abstract_count
  from public.member_abstracts where user_id = p_user_id;

  return jsonb_build_object(
    'bonus_balance', profile.bonus_balance,
    'checked_in_today', checked_today,
    'checkin_cycle', streak % 7,
    'last_seen_at', profile.last_seen_at,
    'signup_bonus_claimed', profile.signup_bonus_claimed_at is not null,
    'abstract_count', abstract_count,
    'abstract_quota', profile.abstract_quota
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
  previous_streak integer;
  current_streak integer;
  award integer := 0;
  profile public.member_profiles%rowtype;
  abstract_count integer;
begin
  perform 1 from public.member_profiles where user_id = p_user_id for update;
  previous_streak := public.member_checkin_streak(p_user_id, shanghai_date - 1);

  insert into public.member_daily_checkins (user_id, checkin_date)
  values (p_user_id, shanghai_date)
  on conflict (user_id, checkin_date) do nothing;
  get diagnostics inserted_count = row_count;

  if inserted_count = 1 then
    award := case when (previous_streak + 1) % 7 = 0 then 2 else 1 end;
    update public.member_profiles
      set bonus_balance = bonus_balance + award, last_seen_at = now(), updated_at = now()
      where user_id = p_user_id;
    insert into public.bonus_ledger (user_id, idempotency_key, delta, reason, metadata)
    values (
      p_user_id,
      'checkin:' || shanghai_date::text,
      award,
      'daily_checkin',
      jsonb_build_object('cycle_completed', award = 2)
    );
  end if;

  select * into profile from public.member_profiles where user_id = p_user_id;
  current_streak := public.member_checkin_streak(p_user_id, shanghai_date);
  select count(*)::integer into abstract_count
  from public.member_abstracts where user_id = p_user_id;
  return jsonb_build_object(
    'bonus_balance', profile.bonus_balance,
    'checked_in_today', true,
    'checkin_cycle', current_streak % 7,
    'last_seen_at', profile.last_seen_at,
    'signup_bonus_claimed', profile.signup_bonus_claimed_at is not null,
    'abstract_count', abstract_count,
    'abstract_quota', profile.abstract_quota,
    'awarded', inserted_count = 1,
    'award_amount', award
  );
end;
$$;

create or replace function public.upgrade_abstract_quota(p_user_id uuid, p_target_quota integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  profile public.member_profiles%rowtype;
  current_cost integer;
  target_cost integer;
  charged integer;
begin
  if p_target_quota not in (100, 500) then raise exception 'invalid_abstract_quota'; end if;
  select * into profile from public.member_profiles where user_id = p_user_id for update;
  if profile.user_id is null then raise exception 'member_not_found'; end if;
  if p_target_quota < profile.abstract_quota then raise exception 'abstract_quota_downgrade'; end if;
  if p_target_quota = profile.abstract_quota then
    return jsonb_build_object(
      'bonus_balance', profile.bonus_balance,
      'abstract_quota', profile.abstract_quota,
      'charged', 0
    );
  end if;

  current_cost := case profile.abstract_quota when 100 then 2 when 500 then 10 else 0 end;
  target_cost := case p_target_quota when 100 then 2 when 500 then 10 end;
  charged := target_cost - current_cost;
  if profile.bonus_balance < charged then raise exception 'insufficient_bonus'; end if;

  update public.member_profiles
  set bonus_balance = bonus_balance - charged,
      abstract_quota = p_target_quota,
      updated_at = now()
  where user_id = p_user_id
  returning * into profile;
  insert into public.bonus_ledger (user_id, idempotency_key, delta, reason, metadata)
  values (
    p_user_id,
    'storage-upgrade:' || p_target_quota::text,
    -charged,
    'storage_upgrade',
    jsonb_build_object('abstract_quota', p_target_quota)
  );

  return jsonb_build_object(
    'bonus_balance', profile.bonus_balance,
    'abstract_quota', profile.abstract_quota,
    'charged', charged
  );
end;
$$;

create or replace function public.save_member_abstract(
  p_user_id uuid,
  p_client_id text,
  p_title text,
  p_conference text,
  p_payload jsonb,
  p_expected_updated_at timestamptz default null
)
returns public.member_abstracts
language plpgsql
security definer
set search_path = public
as $$
declare
  profile public.member_profiles%rowtype;
  existing public.member_abstracts%rowtype;
  saved public.member_abstracts%rowtype;
  abstract_count integer;
begin
  if length(p_client_id) < 1 or length(p_client_id) > 128
     or length(p_conference) < 1 or length(p_conference) > 40
     or length(p_title) > 500 then
    raise exception 'invalid_abstract';
  end if;
  if octet_length(p_payload::text) > 10000 then raise exception 'abstract_too_large'; end if;

  select * into profile from public.member_profiles where user_id = p_user_id for update;
  if profile.user_id is null then raise exception 'member_not_found'; end if;
  select * into existing from public.member_abstracts
  where user_id = p_user_id and client_id = p_client_id for update;

  if existing.id is null then
    if p_expected_updated_at is not null then raise exception 'abstract_conflict'; end if;
    select count(*)::integer into abstract_count
    from public.member_abstracts where user_id = p_user_id;
    if abstract_count >= profile.abstract_quota then raise exception 'abstract_quota_exceeded'; end if;
    insert into public.member_abstracts (user_id, client_id, title, conference, payload)
    values (p_user_id, p_client_id, p_title, p_conference, p_payload)
    returning * into saved;
  else
    if p_expected_updated_at is null or existing.updated_at <> p_expected_updated_at then
      raise exception 'abstract_conflict';
    end if;
    update public.member_abstracts
    set title = p_title, conference = p_conference, payload = p_payload, updated_at = now()
    where id = existing.id
    returning * into saved;
  end if;
  return saved;
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
  if p_task_kind not in (
    'analysis_generation', 'regeneration', 'deep_update', 'image_generation', 'blind_review'
  ) then raise exception 'invalid_task_kind'; end if;

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
    user_id, idempotency_key, task_kind, current_stage, in_flight,
    in_flight_operation, generation_count, deep_update_count
  ) values (
    p_user_id, p_idempotency_key, p_task_kind,
    case when p_task_kind = 'analysis_generation' then 1 else 4 end,
    true,
    p_task_kind,
    case when p_task_kind = 'regeneration' then 1 else 0 end,
    case when p_task_kind = 'deep_update' then 1 else 0 end
  ) returning * into new_task;
  insert into public.bonus_ledger (user_id, idempotency_key, delta, reason, metadata)
  values (
    p_user_id, 'task:reserve:' || p_idempotency_key, -1, 'task_reservation',
    jsonb_build_object('task_id', new_task.id, 'task_kind', p_task_kind)
  );
  return jsonb_build_object(
    'task_id', new_task.id, 'status', new_task.status,
    'bonus_balance', balance, 'charged', true,
    'call_count', new_task.call_count,
    'generation_count', new_task.generation_count,
    'deep_update_count', new_task.deep_update_count
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
  balance integer;
begin
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
  if task.call_count >= 4 then raise exception 'workflow_call_limit'; end if;

  if p_operation in ('generation', 'regeneration') then
    if task.generation_count >= 2 then raise exception 'workflow_generation_limit'; end if;
    update public.managed_generation_tasks
      set generation_count = generation_count + 1,
          current_stage = greatest(current_stage, 4),
          call_count = call_count + 1,
          in_flight = true,
          in_flight_operation = p_operation,
          updated_at = now()
      where id = task.id returning * into task;
  elsif p_operation = 'deep_update' then
    if task.deep_update_count >= 1 then raise exception 'workflow_deep_update_limit'; end if;
    update public.managed_generation_tasks
      set deep_update_count = deep_update_count + 1,
          call_count = call_count + 1,
          in_flight = true,
          in_flight_operation = p_operation,
          updated_at = now()
      where id = task.id returning * into task;
  else
    raise exception 'invalid_workflow_operation';
  end if;

  select bonus_balance into balance from public.member_profiles where user_id = p_user_id;
  return jsonb_build_object(
    'task_id', task.id,
    'status', task.status,
    'bonus_balance', balance,
    'charged', false,
    'call_count', task.call_count,
    'generation_count', task.generation_count,
    'deep_update_count', task.deep_update_count
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
  should_complete boolean;
begin
  perform 1 from public.member_profiles where user_id = p_user_id for update;
  select * into task from public.managed_generation_tasks
    where id = p_task_id and user_id = p_user_id for update;
  if task.id is null then raise exception 'task_not_found'; end if;
  if task.status <> 'reserved' or not task.in_flight then
    select bonus_balance into balance from public.member_profiles where user_id = p_user_id;
    return jsonb_build_object(
      'task_id', task.id, 'status', task.status,
      'bonus_balance', balance, 'refunded', false
    );
  end if;

  if p_success then
    should_complete := p_complete_workflow and task.task_kind <> 'analysis_generation';
    if task.task_kind = 'analysis_generation'
       and task.generation_count >= 2 and task.deep_update_count >= 1 then
      should_complete := true;
    end if;
    update public.managed_generation_tasks
      set status = case when should_complete then 'completed' else 'reserved' end,
          successful_call_count = successful_call_count + 1,
          in_flight = false,
          in_flight_operation = null,
          settled_at = case when should_complete then now() else settled_at end,
          updated_at = now()
      where id = task.id returning * into task;
  elsif task.successful_call_count = 0 then
    update public.managed_generation_tasks
      set status = 'refunded', in_flight = false, in_flight_operation = null,
          settled_at = now(), updated_at = now()
      where id = task.id returning * into task;
    update public.member_profiles
      set bonus_balance = bonus_balance + 1, updated_at = now() where user_id = p_user_id;
    insert into public.bonus_ledger (user_id, idempotency_key, delta, reason, metadata)
    values (
      p_user_id, 'task:refund:' || task.id::text, 1, 'task_refund',
      jsonb_build_object('task_id', task.id)
    ) on conflict (user_id, idempotency_key) do nothing;
    did_refund := true;
  else
    update public.managed_generation_tasks
      set generation_count = generation_count - case
            when in_flight_operation in ('generation', 'regeneration') then 1 else 0 end,
          deep_update_count = deep_update_count - case
            when in_flight_operation = 'deep_update' then 1 else 0 end,
          call_count = greatest(1, call_count - 1),
          in_flight = false,
          in_flight_operation = null,
          updated_at = now()
      where id = task.id returning * into task;
  end if;

  select bonus_balance into balance from public.member_profiles where user_id = p_user_id;
  return jsonb_build_object(
    'task_id', task.id,
    'status', task.status,
    'bonus_balance', balance,
    'refunded', did_refund,
    'call_count', task.call_count,
    'generation_count', task.generation_count,
    'deep_update_count', task.deep_update_count
  );
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
  update public.managed_generation_tasks
    set status = 'completed', settled_at = now(), updated_at = now()
    where user_id = p_user_id and status = 'reserved' and not in_flight
      and task_kind = 'analysis_generation'
      and updated_at < now() - interval '30 minutes';
  get diagnostics recovered = row_count;
  for stale_task in
    select * from public.managed_generation_tasks
    where user_id = p_user_id and status = 'reserved' and in_flight
      and updated_at < now() - interval '150 seconds'
    for update
  loop
    if stale_task.successful_call_count = 0 then
      update public.managed_generation_tasks
        set status = 'refunded', in_flight = false, in_flight_operation = null,
            settled_at = now(), updated_at = now()
        where id = stale_task.id;
      update public.member_profiles
        set bonus_balance = bonus_balance + 1, updated_at = now()
        where user_id = p_user_id;
      insert into public.bonus_ledger (user_id, idempotency_key, delta, reason, metadata)
      values (
        p_user_id, 'task:stale-refund:' || stale_task.id::text, 1, 'task_refund',
        jsonb_build_object('task_id', stale_task.id, 'recovered', true)
      ) on conflict (user_id, idempotency_key) do nothing;
    else
      update public.managed_generation_tasks
        set generation_count = generation_count - case
              when in_flight_operation in ('generation', 'regeneration') then 1 else 0 end,
            deep_update_count = deep_update_count - case
              when in_flight_operation = 'deep_update' then 1 else 0 end,
            call_count = greatest(1, call_count - 1),
            in_flight = false,
            in_flight_operation = null,
            updated_at = now()
        where id = stale_task.id;
    end if;
    recovered := recovered + 1;
  end loop;
  return recovered;
end;
$$;

revoke all on function public.member_checkin_streak(uuid, date) from public, anon, authenticated;
revoke all on function public.upgrade_abstract_quota(uuid, integer) from public, anon, authenticated;
revoke all on function public.save_member_abstract(uuid, text, text, text, jsonb, timestamptz)
  from public, anon, authenticated;
grant execute on function public.member_checkin_streak(uuid, date) to service_role;
grant execute on function public.upgrade_abstract_quota(uuid, integer) to service_role;
grant execute on function public.save_member_abstract(uuid, text, text, text, jsonb, timestamptz)
  to service_role;
