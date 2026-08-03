alter table public.managed_generation_tasks
  add column if not exists credit_cost integer not null default 1;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'managed_generation_tasks_credit_cost_check'
      and conrelid = 'public.managed_generation_tasks'::regclass
  ) then
    alter table public.managed_generation_tasks
      add constraint managed_generation_tasks_credit_cost_check
      check (credit_cost in (1, 2));
  end if;
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
begin
  if length(p_idempotency_key) < 1 or length(p_idempotency_key) > 128 then
    raise exception 'invalid_idempotency_key';
  end if;
  if p_task_kind not in (
    'analysis_generation', 'regeneration', 'deep_update', 'image_generation', 'blind_review'
  ) then raise exception 'invalid_task_kind'; end if;

  task_cost := case when p_task_kind = 'blind_review' then 1 else 2 end;

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
  update public.member_profiles
    set bonus_balance = bonus_balance - task_cost, last_seen_at = now(), updated_at = now()
    where user_id = p_user_id returning bonus_balance into balance;
  insert into public.managed_generation_tasks (
    user_id, idempotency_key, task_kind, current_stage, in_flight,
    in_flight_operation, generation_count, deep_update_count, credit_cost
  ) values (
    p_user_id, p_idempotency_key, p_task_kind,
    case when p_task_kind = 'analysis_generation' then 1 else 4 end,
    true,
    p_task_kind,
    case when p_task_kind = 'regeneration' then 1 else 0 end,
    case when p_task_kind = 'deep_update' then 1 else 0 end,
    task_cost
  ) returning * into new_task;
  insert into public.bonus_ledger (user_id, idempotency_key, delta, reason, metadata)
  values (
    p_user_id, 'task:reserve:' || p_idempotency_key, -task_cost, 'task_reservation',
    jsonb_build_object(
      'task_id', new_task.id,
      'task_kind', p_task_kind,
      'credit_cost', task_cost
    )
  );
  return jsonb_build_object(
    'task_id', new_task.id, 'status', new_task.status,
    'bonus_balance', balance, 'charged', true,
    'credit_cost', new_task.credit_cost,
    'call_count', new_task.call_count,
    'generation_count', new_task.generation_count,
    'deep_update_count', new_task.deep_update_count
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
  elsif task.successful_call_count < case
          when task.task_kind = 'analysis_generation' then 2 else 1 end then
    update public.managed_generation_tasks
      set status = 'refunded', in_flight = false, in_flight_operation = null,
          settled_at = now(), updated_at = now()
      where id = task.id returning * into task;
    update public.member_profiles
      set bonus_balance = bonus_balance + task.credit_cost, updated_at = now()
      where user_id = p_user_id;
    insert into public.bonus_ledger (user_id, idempotency_key, delta, reason, metadata)
    values (
      p_user_id, 'task:refund:' || task.id::text, task.credit_cost, 'task_refund',
      jsonb_build_object('task_id', task.id, 'credit_cost', task.credit_cost)
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
    'credit_cost', task.credit_cost,
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
  completed_count integer := 0;
begin
  perform 1 from public.member_profiles where user_id = p_user_id for update;

  for stale_task in
    select * from public.managed_generation_tasks
    where user_id = p_user_id and status = 'reserved' and not in_flight
      and task_kind = 'analysis_generation' and successful_call_count < 2
      and updated_at < now() - interval '30 minutes'
    for update
  loop
    update public.managed_generation_tasks
      set status = 'refunded', settled_at = now(), updated_at = now()
      where id = stale_task.id;
    update public.member_profiles
      set bonus_balance = bonus_balance + stale_task.credit_cost, updated_at = now()
      where user_id = p_user_id;
    insert into public.bonus_ledger (user_id, idempotency_key, delta, reason, metadata)
    values (
      p_user_id,
      'task:stale-refund:' || stale_task.id::text,
      stale_task.credit_cost,
      'task_refund',
      jsonb_build_object(
        'task_id', stale_task.id,
        'recovered', true,
        'no_deliverable', true,
        'credit_cost', stale_task.credit_cost
      )
    ) on conflict (user_id, idempotency_key) do nothing;
    recovered := recovered + 1;
  end loop;

  update public.managed_generation_tasks
    set status = 'completed', settled_at = now(), updated_at = now()
    where user_id = p_user_id and status = 'reserved' and not in_flight
      and task_kind = 'analysis_generation'
      and generation_count > 0
      and updated_at < now() - interval '30 minutes';
  get diagnostics completed_count = row_count;
  recovered := recovered + completed_count;
  for stale_task in
    select * from public.managed_generation_tasks
    where user_id = p_user_id and status = 'reserved' and in_flight
      and updated_at < now() - interval '150 seconds'
    for update
  loop
    if stale_task.successful_call_count < case
         when stale_task.task_kind = 'analysis_generation' then 2 else 1 end then
      update public.managed_generation_tasks
        set status = 'refunded', in_flight = false, in_flight_operation = null,
            settled_at = now(), updated_at = now()
        where id = stale_task.id;
      update public.member_profiles
        set bonus_balance = bonus_balance + stale_task.credit_cost, updated_at = now()
        where user_id = p_user_id;
      insert into public.bonus_ledger (user_id, idempotency_key, delta, reason, metadata)
      values (
        p_user_id,
        'task:stale-refund:' || stale_task.id::text,
        stale_task.credit_cost,
        'task_refund',
        jsonb_build_object(
          'task_id', stale_task.id,
          'recovered', true,
          'credit_cost', stale_task.credit_cost
        )
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
