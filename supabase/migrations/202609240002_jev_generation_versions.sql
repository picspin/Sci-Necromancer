-- Immutable member-owned output versions for Jev post-check history.
-- Source text is never persisted; only its SHA-256 digest is retained.
create table public.member_jev_generation_versions (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.managed_generation_tasks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  operation text not null check (operation in ('generation', 'deep_update')),
  source_hash text not null check (source_hash ~ '^[a-f0-9]{64}$'),
  conference text check (conference is null or conference in ('ISMRM', 'RSNA', 'ER', 'ASCO', 'ESMO', 'JACC')),
  draft_text text not null,
  final_text text not null,
  draft_hash text not null check (draft_hash ~ '^[a-f0-9]{64}$'),
  final_hash text not null check (final_hash ~ '^[a-f0-9]{64}$'),
  generation_models jsonb not null check (jsonb_typeof(generation_models) = 'array'),
  initial_check jsonb,
  final_check jsonb,
  status text not null check (status in ('check_complete', 'needs_author_review', 'review_unavailable')),
  created_at timestamptz not null default now(),
  unique (task_id, operation),
  check (octet_length(convert_to(draft_text, 'utf8')) <= 100000),
  check (octet_length(convert_to(final_text, 'utf8')) <= 100000),
  check (octet_length(convert_to(generation_models::text, 'utf8')) <= 4096),
  check (initial_check is null or octet_length(convert_to(initial_check::text, 'utf8')) <= 65536),
  check (final_check is null or octet_length(convert_to(final_check::text, 'utf8')) <= 65536)
);

create index member_jev_generation_versions_user_created_idx
  on public.member_jev_generation_versions(user_id, created_at desc);

alter table public.member_jev_generation_versions enable row level security;
revoke all on table public.member_jev_generation_versions from public, anon;
grant select on table public.member_jev_generation_versions to authenticated;
grant all on table public.member_jev_generation_versions to service_role;

create policy member_jev_generation_versions_owner_read
  on public.member_jev_generation_versions for select to authenticated
  using (user_id = auth.uid());

create or replace function public.jev_persist_generation_version(
  p_user_id uuid,
  p_task_id uuid,
  p_operation text,
  p_source_hash text,
  p_conference text,
  p_draft_text text,
  p_final_text text,
  p_draft_hash text,
  p_final_hash text,
  p_generation_models jsonb,
  p_initial_check jsonb,
  p_final_check jsonb,
  p_status text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_user_id is null or p_task_id is null
     or p_operation not in ('generation', 'deep_update')
     or p_source_hash is null or p_source_hash !~ '^[a-f0-9]{64}$'
     or p_conference is not null and p_conference not in ('ISMRM', 'RSNA', 'ER', 'ASCO', 'ESMO', 'JACC')
     or p_draft_text is null or p_final_text is null
     or octet_length(convert_to(p_draft_text, 'utf8')) > 100000
     or octet_length(convert_to(p_final_text, 'utf8')) > 100000
     or p_draft_hash is null or p_draft_hash !~ '^[a-f0-9]{64}$'
     or p_final_hash is null or p_final_hash !~ '^[a-f0-9]{64}$'
     or p_generation_models is null or jsonb_typeof(p_generation_models) <> 'array'
     or jsonb_array_length(p_generation_models) > 4
     or octet_length(convert_to(p_generation_models::text, 'utf8')) > 4096
     or p_initial_check is not null and octet_length(convert_to(p_initial_check::text, 'utf8')) > 65536
     or p_final_check is not null and octet_length(convert_to(p_final_check::text, 'utf8')) > 65536
     or p_status not in ('check_complete', 'needs_author_review', 'review_unavailable') then
    raise exception 'invalid_jev_generation_version';
  end if;
  if not exists (
    select 1 from public.managed_generation_tasks
    where id = p_task_id and user_id = p_user_id and jev_cache_key is not null
  ) then
    raise exception 'jev_generation_workflow_not_found';
  end if;
  insert into public.member_jev_generation_versions(
    task_id, user_id, operation, source_hash, conference,
    draft_text, final_text, draft_hash, final_hash, generation_models,
    initial_check, final_check, status
  ) values (
    p_task_id, p_user_id, p_operation, p_source_hash, p_conference,
    p_draft_text, p_final_text, p_draft_hash, p_final_hash, p_generation_models,
    p_initial_check, p_final_check, p_status
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
  where user_id = p_user_id
  order by created_at desc
  limit least(greatest(coalesce(p_limit, 50), 1), 100)
$$;

revoke all on function public.jev_persist_generation_version(uuid,uuid,text,text,text,text,text,text,text,jsonb,jsonb,jsonb,text), public.jev_list_generation_versions(uuid,integer)
  from public, anon, authenticated;
grant execute on function public.jev_persist_generation_version(uuid,uuid,text,text,text,text,text,text,text,jsonb,jsonb,jsonb,text), public.jev_list_generation_versions(uuid,integer)
  to service_role;
