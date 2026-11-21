-- Private, one-way claim: a process crash does not grant a second provider call.
create table public.member_data_figure_plans (
  version_id uuid primary key references public.member_data_figure_versions(id) on delete cascade,
  claim_token uuid not null default gen_random_uuid(),
  mapping jsonb check (mapping is null or (
    jsonb_typeof(mapping)='object' and octet_length(mapping::text)<=4096
  )),
  claimed_at timestamptz not null default clock_timestamp()
);
alter table public.member_data_figure_plans enable row level security;
revoke all on public.member_data_figure_plans from public, anon, authenticated, service_role;

create function public.claim_data_figure_plan(p_user_id uuid, p_id uuid, p_request_hash text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v public.member_data_figure_versions%rowtype; p public.member_data_figure_plans%rowtype;
begin
  perform public.data_figure_wallet(p_user_id);
  select * into v from public.member_data_figure_versions where id=p_id and user_id=p_user_id;
  if not found then raise exception 'data_figure_not_found'; end if;
  if v.request_hash is distinct from p_request_hash then raise exception 'data_figure_request_conflict'; end if;
  if v.status not in ('reserved','awaiting_render','completed') then
    return jsonb_build_object('kind','terminal','status',v.status);
  end if;
  select * into p from public.member_data_figure_plans where version_id=p_id;
  if found then
    if p.mapping is not null and v.status in ('awaiting_render','completed') then
      return jsonb_build_object('kind','cached','mapping',p.mapping,'specHash',v.spec_hash,
        'provider',v.actual_provider,'model',v.actual_model,'status',v.status);
    end if;
    return jsonb_build_object('kind','pending');
  end if;
  if v.status<>'reserved' then return jsonb_build_object('kind','terminal','status',v.status); end if;
  insert into public.member_data_figure_plans(version_id) values(p_id) returning * into p;
  update public.member_profiles set updated_at=clock_timestamp() where user_id=p_user_id;
  return jsonb_build_object('kind','claimed','token',p.claim_token);
end $$;

create function public.finish_data_figure_plan(
  p_user_id uuid, p_id uuid, p_token uuid, p_mapping jsonb,
  p_spec_hash text, p_actual_provider text, p_actual_model text
) returns jsonb language plpgsql security definer set search_path=public as $$
declare v public.member_data_figure_versions%rowtype; p public.member_data_figure_plans%rowtype;
  v_result jsonb;
begin
  perform public.data_figure_wallet(p_user_id);
  select * into v from public.member_data_figure_versions where id=p_id and user_id=p_user_id;
  if not found then raise exception 'data_figure_not_found'; end if;
  select * into p from public.member_data_figure_plans where version_id=p_id;
  if not found or p.claim_token is distinct from p_token then raise exception 'data_figure_claim_conflict'; end if;
  if v.status not in ('reserved','awaiting_render','completed') then
    return jsonb_build_object('kind','terminal','status',v.status);
  end if;
  if p_mapping is null or jsonb_typeof(p_mapping)<>'object' or octet_length(p_mapping::text)>4096
    or p_mapping='{}'::jsonb then raise exception 'invalid_data_figure_mapping'; end if;
  if exists (select 1 from jsonb_each(p_mapping) as kv where
    kv.key not in ('category','value','group','x','y','row','column','series','label','estimate',
      'lower','upper','component','count','denominator','identifier','log2fc','p','method','metric')
    or jsonb_typeof(kv.value)<>'string' or (kv.value#>>'{}') !~ '^col_([1-9][0-9]?|100)$'
  ) or (select count(*)<>count(distinct value) from jsonb_each(p_mapping))
    then raise exception 'invalid_data_figure_mapping'; end if;
  if p.mapping is not null then
    if p.mapping is distinct from p_mapping or v.spec_hash is distinct from p_spec_hash
      or v.actual_provider is distinct from p_actual_provider or v.actual_model is distinct from p_actual_model
      then raise exception 'data_figure_plan_conflict'; end if;
  else
    if v.status<>'reserved' then raise exception 'data_figure_plan_conflict'; end if;
    v_result:=public.mark_data_figure_renderable(p_user_id,p_id,p_spec_hash,p_actual_provider,p_actual_model);
    if v_result->>'status'<>'awaiting_render' then
      return jsonb_build_object('kind','terminal','status',v_result->>'status');
    end if;
    update public.member_data_figure_plans set mapping=p_mapping where version_id=p_id;
  end if;
  return public.claim_data_figure_plan(p_user_id,p_id,v.request_hash);
end $$;

revoke all on function public.claim_data_figure_plan(uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.claim_data_figure_plan(uuid,uuid,text) to service_role;
revoke all on function public.finish_data_figure_plan(uuid,uuid,uuid,jsonb,text,text,text)
  from public, anon, authenticated;
grant execute on function public.finish_data_figure_plan(uuid,uuid,uuid,jsonb,text,text,text) to service_role;
