-- Owner-only lifecycle lookup. Reuse the wallet lock and expiry cleanup; no debit.
create function public.get_data_figure(p_user_id uuid, p_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v public.member_data_figure_versions%rowtype; v_wallet jsonb;
begin
  v_wallet := public.data_figure_wallet(p_user_id);
  select * into v from public.member_data_figure_versions
    where id=p_id and user_id=p_user_id;
  if not found then raise exception 'data_figure_not_found'; end if;
  return to_jsonb(v) || v_wallet;
end $$;

revoke all on function public.get_data_figure(uuid,uuid) from public, anon, authenticated;
grant execute on function public.get_data_figure(uuid,uuid) to service_role;
