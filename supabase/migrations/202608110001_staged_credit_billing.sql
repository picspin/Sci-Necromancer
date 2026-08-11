alter table public.managed_generation_tasks
  add column if not exists analysis_count integer not null default 0,
  add column if not exists in_flight_credit_cost integer not null default 0;

alter table public.managed_generation_tasks
  drop constraint if exists managed_generation_tasks_credit_cost_check;
alter table public.managed_generation_tasks
  add constraint managed_generation_tasks_credit_cost_check check (credit_cost >= 0);
alter table public.managed_generation_tasks
  drop constraint if exists managed_generation_tasks_call_count_check;
alter table public.managed_generation_tasks
  add constraint managed_generation_tasks_call_count_check check (call_count between 1 and 20);

alter table public.bonus_ledger drop constraint if exists bonus_ledger_reason_check;
alter table public.bonus_ledger add constraint bonus_ledger_reason_check check (reason in (
  'signup', 'daily_checkin', 'analysis_retry', 'generation', 'deep_update',
  'task_reservation', 'task_refund', 'storage_upgrade',
  'stripe_purchase', 'stripe_refund', 'stripe_dispute', 'stripe_reinstatement'
));

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
  credit_history jsonb;
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
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', ledger.id::text,
    'delta', ledger.delta,
    'reason', ledger.reason,
    'metadata', ledger.metadata,
    'created_at', ledger.created_at
  ) order by ledger.created_at desc), '[]'::jsonb)
  into credit_history
  from (
    select * from public.bonus_ledger
    where user_id = p_user_id
    order by created_at desc
    limit 50
  ) ledger;

  return jsonb_build_object(
    'bonus_balance', profile.bonus_balance,
    'checked_in_today', checked_today,
    'checkin_cycle', streak % 7,
    'last_seen_at', profile.last_seen_at,
    'signup_bonus_claimed', profile.signup_bonus_claimed_at is not null,
    'abstract_count', abstract_count,
    'abstract_quota', profile.abstract_quota,
    'credit_history', credit_history
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
  task_cost integer;
  ledger_reason text;
begin
  if length(p_idempotency_key) < 1 or length(p_idempotency_key) > 128 then
    raise exception 'invalid_idempotency_key';
  end if;
  if p_task_kind not in (
    'analysis_generation', 'regeneration', 'deep_update', 'image_generation', 'blind_review'
  ) then raise exception 'invalid_task_kind'; end if;

  task_cost := case
    when p_task_kind = 'analysis_generation' then 0
    when p_task_kind = 'image_generation' then 2
    else 1
  end;
  ledger_reason := case
    when p_task_kind = 'deep_update' then 'deep_update'
    when p_task_kind = 'regeneration' then 'generation'
    else 'task_reservation'
  end;

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
  if balance < task_cost then raise exception 'insufficient_bonus'; end if;
  if task_cost > 0 then
    update public.member_profiles
      set bonus_balance = bonus_balance - task_cost, last_seen_at = now(), updated_at = now()
      where user_id = p_user_id returning bonus_balance into balance;
  end if;
  insert into public.managed_generation_tasks (
    user_id, idempotency_key, task_kind, current_stage, in_flight,
    in_flight_operation, analysis_count, generation_count, deep_update_count,
    credit_cost, in_flight_credit_cost
  ) values (
    p_user_id, p_idempotency_key, p_task_kind,
    case when p_task_kind = 'analysis_generation' then 1 else 4 end,
    true,
    case when p_task_kind = 'analysis_generation' then 'analysis' else p_task_kind end,
    case when p_task_kind = 'analysis_generation' then 1 else 0 end,
    case when p_task_kind = 'regeneration' then 1 else 0 end,
    case when p_task_kind = 'deep_update' then 1 else 0 end,
    task_cost,
    task_cost
  ) returning * into new_task;
  if task_cost > 0 then
    insert into public.bonus_ledger (user_id, idempotency_key, delta, reason, metadata)
    values (
      p_user_id, 'task:charge:' || new_task.id::text || ':1', -task_cost, ledger_reason,
      jsonb_build_object('task_id', new_task.id, 'task_kind', p_task_kind)
    );
  end if;
  return jsonb_build_object(
    'task_id', new_task.id, 'status', new_task.status,
    'bonus_balance', balance, 'charged', task_cost > 0,
    'credit_cost', new_task.credit_cost,
    'analysis_count', new_task.analysis_count,
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
  operation_cost integer;
  ledger_reason text;
  operation_index integer;
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
  if task.call_count >= 20 then raise exception 'workflow_call_limit'; end if;

  if p_operation = 'analysis' then
    if task.generation_count > 0 then raise exception 'invalid_workflow_transition'; end if;
    operation_cost := case when task.analysis_count >= 2 then 1 else 0 end;
    ledger_reason := 'analysis_retry';
    operation_index := task.analysis_count + 1;
  elsif p_operation in ('generation', 'regeneration') then
    if task.generation_count >= 1 then raise exception 'workflow_generation_limit'; end if;
    operation_cost := 1;
    ledger_reason := 'generation';
    operation_index := task.generation_count + 1;
  elsif p_operation = 'deep_update' then
    if task.generation_count < 1 then raise exception 'invalid_workflow_transition'; end if;
    if task.deep_update_count >= 1 then raise exception 'workflow_deep_update_limit'; end if;
    operation_cost := 1;
    ledger_reason := 'deep_update';
    operation_index := task.deep_update_count + 1;
  else
    raise exception 'invalid_workflow_operation';
  end if;

  select bonus_balance into balance from public.member_profiles where user_id = p_user_id;
  if balance < operation_cost then raise exception 'insufficient_bonus'; end if;
  if operation_cost > 0 then
    update public.member_profiles
      set bonus_balance = bonus_balance - operation_cost, last_seen_at = now(), updated_at = now()
      where user_id = p_user_id returning bonus_balance into balance;
    insert into public.bonus_ledger (user_id, idempotency_key, delta, reason, metadata)
    values (
      p_user_id,
      'task:charge:' || task.id::text || ':' || p_operation || ':' || operation_index::text,
      -operation_cost,
      ledger_reason,
      jsonb_build_object('task_id', task.id, 'operation', p_operation)
    );
  end if;

  update public.managed_generation_tasks
    set analysis_count = analysis_count + case when p_operation = 'analysis' then 1 else 0 end,
        generation_count = generation_count + case
          when p_operation in ('generation', 'regeneration') then 1 else 0 end,
        deep_update_count = deep_update_count + case when p_operation = 'deep_update' then 1 else 0 end,
        current_stage = case
          when p_operation in ('generation', 'regeneration', 'deep_update') then 4
          else current_stage end,
        call_count = call_count + 1,
        in_flight = true,
        in_flight_operation = p_operation,
        in_flight_credit_cost = operation_cost,
        credit_cost = credit_cost + operation_cost,
        updated_at = now()
    where id = task.id returning * into task;

  return jsonb_build_object(
    'task_id', task.id, 'status', task.status,
    'bonus_balance', balance, 'charged', operation_cost > 0,
    'credit_cost', task.credit_cost,
    'analysis_count', task.analysis_count,
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
  failed_operation text;
  failed_cost integer;
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

  failed_operation := task.in_flight_operation;
  failed_cost := task.in_flight_credit_cost;
  if p_success then
    should_complete := p_complete_workflow and task.task_kind <> 'analysis_generation';
    if task.task_kind = 'analysis_generation'
       and task.generation_count >= 1 and task.deep_update_count >= 1 then
      should_complete := true;
    end if;
    update public.managed_generation_tasks
      set status = case when should_complete then 'completed' else 'reserved' end,
          successful_call_count = successful_call_count + 1,
          in_flight = false,
          in_flight_operation = null,
          in_flight_credit_cost = 0,
          settled_at = case when should_complete then now() else settled_at end,
          updated_at = now()
      where id = task.id returning * into task;
  else
    if failed_cost > 0 then
      update public.member_profiles
        set bonus_balance = bonus_balance + failed_cost, updated_at = now()
        where user_id = p_user_id;
      insert into public.bonus_ledger (user_id, idempotency_key, delta, reason, metadata)
      values (
        p_user_id,
        'task:refund:' || task.id::text || ':' || task.call_count::text,
        failed_cost,
        'task_refund',
        jsonb_build_object('task_id', task.id, 'operation', failed_operation)
      ) on conflict (user_id, idempotency_key) do nothing;
      did_refund := true;
    end if;
    update public.managed_generation_tasks
      set status = case when successful_call_count = 0 then 'refunded' else status end,
          analysis_count = greatest(0, analysis_count - case
            when failed_operation = 'analysis' then 1 else 0 end),
          generation_count = greatest(0, generation_count - case
            when failed_operation in ('generation', 'regeneration') then 1 else 0 end),
          deep_update_count = greatest(0, deep_update_count - case
            when failed_operation = 'deep_update' then 1 else 0 end),
          call_count = greatest(1, call_count - case when successful_call_count > 0 then 1 else 0 end),
          credit_cost = greatest(0, credit_cost - failed_cost),
          in_flight = false,
          in_flight_operation = null,
          in_flight_credit_cost = 0,
          settled_at = case when successful_call_count = 0 then now() else settled_at end,
          updated_at = now()
      where id = task.id returning * into task;
  end if;

  select bonus_balance into balance from public.member_profiles where user_id = p_user_id;
  return jsonb_build_object(
    'task_id', task.id, 'status', task.status,
    'bonus_balance', balance, 'refunded', did_refund,
    'credit_cost', task.credit_cost,
    'analysis_count', task.analysis_count,
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
      and updated_at < now() - interval '30 minutes';
  get diagnostics recovered = row_count;

  for stale_task in
    select * from public.managed_generation_tasks
    where user_id = p_user_id and status = 'reserved' and in_flight
      and updated_at < now() - interval '150 seconds'
    for update
  loop
    if stale_task.in_flight_credit_cost > 0 then
      update public.member_profiles
        set bonus_balance = bonus_balance + stale_task.in_flight_credit_cost, updated_at = now()
        where user_id = p_user_id;
      insert into public.bonus_ledger (user_id, idempotency_key, delta, reason, metadata)
      values (
        p_user_id,
        'task:stale-refund:' || stale_task.id::text || ':' || stale_task.call_count::text,
        stale_task.in_flight_credit_cost,
        'task_refund',
        jsonb_build_object('task_id', stale_task.id, 'recovered', true)
      ) on conflict (user_id, idempotency_key) do nothing;
    end if;
    update public.managed_generation_tasks
      set status = case when successful_call_count = 0 then 'refunded' else status end,
          analysis_count = greatest(0, analysis_count - case
            when in_flight_operation = 'analysis' then 1 else 0 end),
          generation_count = greatest(0, generation_count - case
            when in_flight_operation in ('generation', 'regeneration') then 1 else 0 end),
          deep_update_count = greatest(0, deep_update_count - case
            when in_flight_operation = 'deep_update' then 1 else 0 end),
          call_count = greatest(1, call_count - case when successful_call_count > 0 then 1 else 0 end),
          credit_cost = greatest(0, credit_cost - in_flight_credit_cost),
          in_flight = false,
          in_flight_operation = null,
          in_flight_credit_cost = 0,
          settled_at = case when successful_call_count = 0 then now() else settled_at end,
          updated_at = now()
      where id = stale_task.id;
    recovered := recovered + 1;
  end loop;
  return recovered;
end;
$$;
