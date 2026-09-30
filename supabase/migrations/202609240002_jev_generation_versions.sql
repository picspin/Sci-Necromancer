-- Immutable member-owned output versions for Jev post-check history.
-- Source text is never persisted; only its SHA-256 digest is retained.
create table public.member_jev_generation_versions (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.managed_generation_tasks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  operation text not null check (operation in ('generation', 'deep_update')),
  source_hash text not null check (source_hash ~ '^[a-f0-9]{64}$'),
  conference text not null check (conference in ('ISMRM', 'RSNA', 'ER', 'ASCO', 'ESMO', 'JACC')),
  draft_text text not null,
  final_text text not null,
  draft_hash text not null check (draft_hash ~ '^[a-f0-9]{64}$'),
  final_hash text not null check (final_hash ~ '^[a-f0-9]{64}$'),
  generation_models jsonb not null check (jsonb_typeof(generation_models) = 'array'),
  generation_calls jsonb not null check (jsonb_typeof(generation_calls) = 'array'),
  initial_check jsonb,
  final_check jsonb,
  status text not null check (status in ('check_complete', 'needs_author_review', 'review_unavailable')),
  unavailable_reason text check (unavailable_reason is null or unavailable_reason in (
    'missing_actual_model', 'unassessable_output', 'post_check_failed', 'recheck_failed', 'consent_revoked', 'consent_unavailable', 'time_budget_exhausted'
  )),
  delivered boolean not null default false,
  created_at timestamptz not null default now(),
  unique (task_id, operation),
  check (octet_length(convert_to(draft_text, 'utf8')) <= 100000),
  check (octet_length(convert_to(final_text, 'utf8')) <= 100000),
  check (octet_length(convert_to(generation_models::text, 'utf8')) <= 4096),
  check (octet_length(convert_to(generation_calls::text, 'utf8')) <= 4096),
  check (initial_check is null or octet_length(convert_to(initial_check::text, 'utf8')) <= 65536),
  check (final_check is null or octet_length(convert_to(final_check::text, 'utf8')) <= 65536)
);

create index member_jev_generation_versions_user_created_idx
  on public.member_jev_generation_versions(user_id, created_at desc);

alter table public.member_jev_generation_versions enable row level security;
revoke all on table public.member_jev_generation_versions from public, anon;
grant select on table public.member_jev_generation_versions to authenticated;
grant insert on table public.member_jev_generation_versions to service_role;

create policy member_jev_generation_versions_owner_read
  on public.member_jev_generation_versions for select to authenticated
  using (user_id = auth.uid() and delivered);

create or replace function public.jev_persist_generation_version(
  p_user_id uuid,
  p_version_id uuid,
  p_task_id uuid,
  p_operation text,
  p_source_hash text,
  p_conference text,
  p_draft_text text,
  p_final_text text,
  p_draft_hash text,
  p_final_hash text,
  p_generation_models jsonb,
  p_generation_calls jsonb,
  p_initial_check jsonb,
  p_final_check jsonb,
  p_status text,
  p_unavailable_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_user_id is null or p_version_id is null or p_task_id is null
     or p_operation is null or p_operation not in ('generation', 'deep_update')
     or p_source_hash is null or p_source_hash !~ '^[a-f0-9]{64}$'
     or p_conference is null or p_conference not in ('ISMRM', 'RSNA', 'ER', 'ASCO', 'ESMO', 'JACC')
     or p_draft_text is null or p_final_text is null
     or octet_length(convert_to(p_draft_text, 'utf8')) > 100000
     or octet_length(convert_to(p_final_text, 'utf8')) > 100000
     or p_draft_hash is null or p_draft_hash !~ '^[a-f0-9]{64}$'
     or p_final_hash is null or p_final_hash !~ '^[a-f0-9]{64}$'
     or p_generation_models is null or jsonb_typeof(p_generation_models) <> 'array'
     or jsonb_array_length(p_generation_models) > 4
     or octet_length(convert_to(p_generation_models::text, 'utf8')) > 4096
     or p_generation_calls is null or jsonb_typeof(p_generation_calls) <> 'array'
     or jsonb_array_length(p_generation_calls) > 4
     or octet_length(convert_to(p_generation_calls::text, 'utf8')) > 4096
     or p_initial_check is not null and octet_length(convert_to(p_initial_check::text, 'utf8')) > 65536
     or p_final_check is not null and octet_length(convert_to(p_final_check::text, 'utf8')) > 65536
     or p_status is null or p_status not in ('check_complete', 'needs_author_review', 'review_unavailable')
     or p_unavailable_reason is not null and p_unavailable_reason not in (
       'missing_actual_model', 'unassessable_output', 'post_check_failed', 'recheck_failed', 'consent_revoked', 'consent_unavailable', 'time_budget_exhausted'
     ) then
    raise exception 'invalid_jev_generation_version';
  end if;
  if not exists (
    select 1 from public.managed_generation_tasks
    where id = p_task_id and user_id = p_user_id and jev_cache_key is not null
      and jev_source_hash = p_source_hash and jev_conference is not distinct from p_conference
      and in_flight and in_flight_operation = p_operation
  ) then
    raise exception 'jev_generation_workflow_not_found';
  end if;
  insert into public.member_jev_generation_versions(
    id, task_id, user_id, operation, source_hash, conference,
    draft_text, final_text, draft_hash, final_hash, generation_models, generation_calls,
    initial_check, final_check, status, unavailable_reason
  ) values (
    p_version_id, p_task_id, p_user_id, p_operation, p_source_hash, p_conference,
    p_draft_text, p_final_text, p_draft_hash, p_final_hash, p_generation_models, p_generation_calls,
    p_initial_check, p_final_check, p_status, p_unavailable_reason
  ) returning id into v_id;
  return jsonb_build_object('id', v_id);
exception
  when unique_violation then
    raise exception 'jev_generation_version_exists';
end;
$$;

create or replace function public.jev_list_generation_versions(
  p_user_id uuid,
  p_limit integer default 50
)
returns setof public.member_jev_generation_versions
language sql
security definer
set search_path = public
as $$
  select * from public.member_jev_generation_versions
  where user_id = p_user_id and delivered
  order by created_at desc
  limit least(greatest(coalesce(p_limit, 50), 1), 100)
$$;

-- Settlement publishes a successful version atomically with its wallet outcome.
-- A refunded/failed call cannot leave a visible generated abstract version.
create or replace function public.jev_publish_generation_version_on_settlement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.in_flight and not new.in_flight
     and old.in_flight_operation in ('generation', 'deep_update') then
    if new.successful_call_count > old.successful_call_count then
      update public.member_jev_generation_versions
      set delivered = true
      where task_id = old.id and operation = old.in_flight_operation and not delivered;
    else
      delete from public.member_jev_generation_versions
      where task_id = old.id and operation = old.in_flight_operation and not delivered;
    end if;
  end if;
  return new;
end;
$$;

create trigger jev_publish_generation_version_after_settlement
  after update of in_flight on public.managed_generation_tasks
  for each row execute function public.jev_publish_generation_version_on_settlement();

revoke all on function public.jev_persist_generation_version(uuid,uuid,uuid,text,text,text,text,text,text,text,jsonb,jsonb,jsonb,jsonb,text,text), public.jev_list_generation_versions(uuid,integer)
  from public, anon, authenticated;
grant execute on function public.jev_persist_generation_version(uuid,uuid,uuid,text,text,text,text,text,text,text,jsonb,jsonb,jsonb,jsonb,text,text), public.jev_list_generation_versions(uuid,integer)
  to service_role;

revoke all on function public.jev_publish_generation_version_on_settlement()
  from public, anon, authenticated;
