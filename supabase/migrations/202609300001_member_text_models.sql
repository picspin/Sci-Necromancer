-- New member choices use DeepSeek V4.1 Flash and GPT-5.6 Terra.
-- Keep the former IDs valid only to finish workflows opened before rollout.
alter table public.managed_generation_tasks
  drop constraint if exists managed_generation_tasks_jev_context_check;
alter table public.managed_generation_tasks
  add constraint managed_generation_tasks_jev_context_check
  check (
    (jev_cache_key is null and jev_source_hash is null and jev_conference is null and jev_locked_model is null)
    or (
      jev_cache_key is not null and jev_source_hash is not null
      and jev_source_hash ~ '^[a-f0-9]{64}$'
      and jev_conference is not null
      and jev_conference in ('ISMRM', 'RSNA', 'ER', 'ASCO', 'ESMO', 'JACC')
      and jev_locked_model is not null
      and jev_locked_model in (
        'deepseek-v4.1-flash', 'gpt-5.6-terra', 'glm-5.2', 'gpt-5.6-luna'
      )
    )
  );

create or replace function public.jev_open_generation_workflow(
  p_user_id uuid,
  p_idempotency_key text,
  p_cache_key text,
  p_source_hash text,
  p_conference text,
  p_locked_model text,
  p_version text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task public.managed_generation_tasks%rowtype;
  v_balance integer;
begin
  if p_idempotency_key is null or length(p_idempotency_key) < 1 or length(p_idempotency_key) > 128
     or p_cache_key is null or p_cache_key !~ '^[a-f0-9]{64}$'
     or p_source_hash is null or p_source_hash !~ '^[a-f0-9]{64}$'
     or p_conference is null or p_conference not in ('ISMRM', 'RSNA', 'ER', 'ASCO', 'ESMO', 'JACC')
     or p_locked_model is null or p_locked_model not in (
       'deepseek-v4.1-flash', 'gpt-5.6-terra', 'glm-5.2', 'gpt-5.6-luna'
     )
     or p_version is null or p_version <> 'typesafe-member-2026-09-21-v1' then
    raise exception 'invalid_jev_workflow_request';
  end if;

  select bonus_balance into v_balance from public.member_profiles
    where user_id = p_user_id for update;
  if not found then raise exception 'jev_member_not_found'; end if;
  if v_balance <= 0 then raise exception 'insufficient_bonus'; end if;
  if not exists (
    select 1 from public.member_jev_consents
    where user_id = p_user_id and version = p_version and accepted
  ) then raise exception 'jev_consent_required'; end if;

  select * into v_task from public.managed_generation_tasks
    where user_id = p_user_id and idempotency_key = p_idempotency_key for update;
  if found then
    if v_task.task_kind <> 'analysis_generation'
       or v_task.jev_cache_key is distinct from p_cache_key
       or v_task.jev_source_hash is distinct from p_source_hash
       or v_task.jev_conference is distinct from p_conference
       or v_task.jev_locked_model is distinct from p_locked_model then
      raise exception 'idempotency_key_conflict';
    end if;
    if v_task.status <> 'reserved' then raise exception 'workflow_completed'; end if;
    return jsonb_build_object(
      'task_id', v_task.id,
      'bonus_balance', v_balance,
      'analysis_count', v_task.analysis_count,
      'generation_count', v_task.generation_count,
      'deep_update_count', v_task.deep_update_count,
      'call_count', v_task.call_count
    );
  end if;

  insert into public.managed_generation_tasks (
    user_id, idempotency_key, task_kind, status, current_stage,
    in_flight, in_flight_operation, in_flight_credit_cost,
    credit_cost, call_count, successful_call_count,
    analysis_count, generation_count, deep_update_count,
    jev_cache_key, jev_source_hash, jev_conference, jev_locked_model
  ) values (
    p_user_id, p_idempotency_key, 'analysis_generation', 'reserved', 1,
    false, null, 0,
    0, 1, 1,
    1, 0, 0, p_cache_key, p_source_hash, p_conference, p_locked_model
  ) returning * into v_task;

  return jsonb_build_object(
    'task_id', v_task.id,
    'bonus_balance', v_balance,
    'analysis_count', v_task.analysis_count,
    'generation_count', v_task.generation_count,
    'deep_update_count', v_task.deep_update_count,
    'call_count', v_task.call_count
  );
end;
$$;

revoke all on function public.jev_open_generation_workflow(uuid,text,text,text,text,text,text)
  from public, anon, authenticated;
grant execute on function public.jev_open_generation_workflow(uuid,text,text,text,text,text,text)
  to service_role;

create or replace function public.jev_assert_generation_context(
  p_user_id uuid,
  p_task_id uuid,
  p_source_hash text,
  p_conference text,
  p_model text,
  p_operation text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task public.managed_generation_tasks%rowtype;
begin
  select * into v_task from public.managed_generation_tasks
    where id = p_task_id and user_id = p_user_id;
  if not found then raise exception 'workflow_not_found'; end if;
  if v_task.jev_cache_key is null then return jsonb_build_object('jev', false); end if;
  if p_source_hash is null or p_source_hash is distinct from v_task.jev_source_hash
     or p_conference is null or p_conference is distinct from v_task.jev_conference
     or p_model is null or p_model not in (
       'deepseek-v4.1-flash', 'gpt-5.6-terra', 'glm-5.2', 'gpt-5.6-luna'
     )
     or p_operation is null or p_operation not in ('generation', 'regeneration', 'deep_update') then
    raise exception 'jev_generation_context_mismatch';
  end if;
  if v_task.generation_count = 0 and p_model is distinct from v_task.jev_locked_model then
    raise exception 'jev_generation_context_mismatch';
  end if;
  return jsonb_build_object('jev', true);
end;
$$;

revoke all on function public.jev_assert_generation_context(uuid,uuid,text,text,text,text)
  from public, anon, authenticated;
grant execute on function public.jev_assert_generation_context(uuid,uuid,text,text,text,text)
  to service_role;
