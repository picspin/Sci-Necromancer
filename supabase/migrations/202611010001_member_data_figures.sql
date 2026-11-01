-- Browser-rendered figures: holds are NOT debits or proof of rendering.
-- Raw data and image bytes are never stored here. Apply only after release approval.
create table public.member_data_figure_versions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  idempotency_key text not null check (length(idempotency_key) between 1 and 128),
  parent_id uuid references public.member_data_figure_versions(id),
  request_hash text not null check (request_hash ~ '^[a-f0-9]{64}$'),
  dataset_hash text not null check (dataset_hash ~ '^[a-f0-9]{64}$'),
  requested_model text not null check (requested_model in ('deepseek-v4.1-flash', 'gpt-5.6-terra')),
  actual_provider text check (actual_provider = 'mga'),
  actual_model text check (length(btrim(actual_model)) between 1 and 128),
  spec_hash text check (spec_hash ~ '^[a-f0-9]{64}$'),
  receipt_hash text check (receipt_hash ~ '^[a-f0-9]{64}$'),
  status text not null default 'reserved' check (status in (
    'reserved', 'awaiting_render', 'completed', 'failed', 'cancelled', 'expired'
  )),
  created_at timestamptz not null default clock_timestamp(),
  lease_expires_at timestamptz not null default clock_timestamp() + interval '15 minutes',
  settled_at timestamptz,
  unique (user_id, idempotency_key),
  check (status not in ('awaiting_render', 'completed') or (
    actual_provider is not null and actual_model is not null and spec_hash is not null
  )),
  check (status <> 'completed' or (receipt_hash is not null and settled_at is not null))
);
create unique index member_data_figure_single_active_idx
  on public.member_data_figure_versions(user_id) where status in ('reserved', 'awaiting_render');
create index member_data_figure_user_created_idx
  on public.member_data_figure_versions(user_id, created_at desc);
alter table public.member_data_figure_versions enable row level security;
revoke all on public.member_data_figure_versions from public, anon, authenticated, service_role;
grant select on public.member_data_figure_versions to authenticated, service_role;
create policy member_data_figure_owner_read on public.member_data_figure_versions
  for select to authenticated using (user_id = auth.uid());

-- Every caller first takes the SAME profile row lock as existing wallet RPCs.
create function public.data_figure_wallet(p_user_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_balance integer; v_held integer;
begin
  select bonus_balance into v_balance from public.member_profiles where user_id=p_user_id for update;
  if not found then raise exception 'member_not_found'; end if;
  update public.member_data_figure_versions set status='expired', settled_at=clock_timestamp()
    where user_id=p_user_id and status in ('reserved','awaiting_render')
      and lease_expires_at<=clock_timestamp();
  select count(*)::integer into v_held from public.member_data_figure_versions
    where user_id=p_user_id and status in ('reserved','awaiting_render');
  return jsonb_build_object('bonus_balance',v_balance,'held_bonus',v_held,
    'available_bonus',v_balance-v_held);
end $$;

create function public.reserve_data_figure(
  p_user_id uuid, p_idempotency_key text, p_request_hash text, p_dataset_hash text,
  p_requested_model text, p_parent_id uuid default null
) returns jsonb language plpgsql security definer set search_path=public as $$
declare v public.member_data_figure_versions%rowtype; v_wallet jsonb;
begin
  if p_idempotency_key is null or length(p_idempotency_key) not between 1 and 128
    or nullif(btrim(p_idempotency_key),'') is null
    or p_request_hash is null or p_request_hash !~ '^[a-f0-9]{64}$'
    or p_dataset_hash is null or p_dataset_hash !~ '^[a-f0-9]{64}$'
    or p_requested_model is null or p_requested_model not in ('deepseek-v4.1-flash','gpt-5.6-terra')
    then raise exception 'invalid_data_figure_request'; end if;
  v_wallet := public.data_figure_wallet(p_user_id);
  select * into v from public.member_data_figure_versions
    where user_id=p_user_id and idempotency_key=p_idempotency_key;
  if found then
    if v.request_hash<>p_request_hash or v.dataset_hash<>p_dataset_hash
      or v.requested_model<>p_requested_model or v.parent_id is distinct from p_parent_id
      then raise exception 'data_figure_idempotency_conflict'; end if;
    return to_jsonb(v) || v_wallet;
  end if;
  if p_parent_id is not null and not exists (
    select 1 from public.member_data_figure_versions
    where id=p_parent_id and user_id=p_user_id and status='completed'
  ) then raise exception 'data_figure_parent_not_found'; end if;
  if exists (select 1 from public.member_data_figure_versions
    where user_id=p_user_id and status in ('reserved','awaiting_render'))
    then raise exception 'data_figure_busy'; end if;
  if (select count(*) from public.member_data_figure_versions
    where user_id=p_user_id and created_at>clock_timestamp()-interval '1 hour')>=20
    then raise exception 'data_figure_rate_limited'; end if;
  if (v_wallet->>'available_bonus')::integer<1 then raise exception 'insufficient_bonus'; end if;
  insert into public.member_data_figure_versions(user_id,idempotency_key,request_hash,dataset_hash,
    requested_model,parent_id) values(p_user_id,p_idempotency_key,p_request_hash,p_dataset_hash,
    p_requested_model,p_parent_id) returning * into v;
  -- Force a profile tuple change: REPEATABLE READ competitors must retry,
  -- rather than checking a snapshot predating this newly inserted hold.
  update public.member_profiles set updated_at=clock_timestamp() where user_id=p_user_id;
  return to_jsonb(v) || public.data_figure_wallet(p_user_id);
end $$;

-- Covers existing text/image/review/storage spenders without rewriting their
-- charging rules. UPDATE already owns the profile row lock before this trigger.
create function public.guard_data_figure_hold() returns trigger
language plpgsql security definer set search_path=public as $$
declare v_held integer;
begin
  if new.bonus_balance>=old.bonus_balance then return new; end if;
  select count(*)::integer into v_held from public.member_data_figure_versions
    where user_id=new.user_id and status in ('reserved','awaiting_render')
      and lease_expires_at>clock_timestamp();
  if v_held>0 and new.bonus_balance<v_held then raise exception 'insufficient_bonus'; end if;
  return new;
end $$;
create trigger guard_data_figure_hold_before_debit before update of bonus_balance
  on public.member_profiles for each row execute function public.guard_data_figure_hold();

create function public.mark_data_figure_renderable(
  p_user_id uuid, p_id uuid, p_spec_hash text, p_actual_provider text, p_actual_model text
) returns jsonb language plpgsql security definer set search_path=public as $$
declare v public.member_data_figure_versions%rowtype; v_wallet jsonb;
begin
  if p_spec_hash is null or p_spec_hash !~ '^[a-f0-9]{64}$'
    or p_actual_provider is distinct from 'mga' or p_actual_model is null
    or length(btrim(p_actual_model)) not between 1 and 128
    then raise exception 'invalid_data_figure_plan'; end if;
  v_wallet:=public.data_figure_wallet(p_user_id);
  select * into v from public.member_data_figure_versions where id=p_id and user_id=p_user_id for update;
  if not found then raise exception 'data_figure_not_found'; end if;
  if v.status='awaiting_render' then
    if v.spec_hash<>p_spec_hash or v.actual_provider<>p_actual_provider or v.actual_model<>p_actual_model
      then raise exception 'data_figure_plan_conflict'; end if;
  elsif v.status='reserved' then
    update public.member_data_figure_versions set status='awaiting_render', spec_hash=p_spec_hash,
      actual_provider=p_actual_provider, actual_model=p_actual_model where id=p_id returning * into v;
  else
    -- Expiry must commit (not be rolled back by raising an exception).
    return to_jsonb(v) || v_wallet;
  end if;
  return to_jsonb(v) || v_wallet;
end $$;

create function public.settle_data_figure(
  p_user_id uuid, p_id uuid, p_outcome text, p_spec_hash text default null, p_receipt_hash text default null
) returns jsonb language plpgsql security definer set search_path=public as $$
declare v public.member_data_figure_versions%rowtype; v_wallet jsonb;
begin
  if p_outcome is null or p_outcome not in ('completed','failed','cancelled')
    then raise exception 'invalid_data_figure_outcome'; end if;
  v_wallet:=public.data_figure_wallet(p_user_id);
  select * into v from public.member_data_figure_versions where id=p_id and user_id=p_user_id for update;
  if not found then raise exception 'data_figure_not_found'; end if;
  if v.status not in ('reserved','awaiting_render') then
    if v.status='completed' and p_outcome='completed' and (
      v.spec_hash is distinct from p_spec_hash or v.receipt_hash is distinct from p_receipt_hash
    ) then raise exception 'data_figure_receipt_conflict'; end if;
    return to_jsonb(v) || v_wallet;
  end if;
  if p_outcome='completed' then
    if v.status<>'awaiting_render' then raise exception 'data_figure_not_renderable'; end if;
    if p_spec_hash is distinct from v.spec_hash then raise exception 'data_figure_spec_conflict'; end if;
    if p_receipt_hash is null or p_receipt_hash !~ '^[a-f0-9]{64}$'
      then raise exception 'invalid_data_figure_receipt'; end if;
    -- Release this hold and debit atomically under the common profile lock.
    update public.member_data_figure_versions set status='completed', receipt_hash=p_receipt_hash,
      settled_at=clock_timestamp() where id=p_id returning * into v;
    update public.member_profiles set bonus_balance=bonus_balance-1, updated_at=clock_timestamp()
      where user_id=p_user_id;
    insert into public.bonus_ledger(user_id,idempotency_key,delta,reason,metadata) values (
      p_user_id,'figure:charge:'||p_id::text,-1,'generation',jsonb_build_object(
        'area','data_figure','version_id',p_id,'parent_id',v.parent_id,
        'requested_model',v.requested_model,'actual_provider',v.actual_provider,'actual_model',v.actual_model
      )
    );
  else
    update public.member_data_figure_versions set status=p_outcome, settled_at=clock_timestamp()
      where id=p_id returning * into v;
  end if;
  return to_jsonb(v) || public.data_figure_wallet(p_user_id);
end $$;

-- Authorization metadata only; never an image upload or a paid download.
create function public.authorize_data_figure_export(p_user_id uuid, p_id uuid, p_format text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v public.member_data_figure_versions%rowtype;
begin
  if p_format is null or p_format not in ('png','pdf','svg','reproducibility')
    then raise exception 'invalid_data_figure_format'; end if;
  select * into v from public.member_data_figure_versions
    where id=p_id and user_id=p_user_id and status='completed';
  if not found then raise exception 'data_figure_export_unavailable'; end if;
  return jsonb_build_object('id',v.id,'dataset_hash',v.dataset_hash,'spec_hash',v.spec_hash,
    'receipt_hash',v.receipt_hash,'format',p_format,'extra_credit_cost',0);
end $$;

revoke all on function public.authorize_data_figure_export(uuid,uuid,text)
  from public, anon, authenticated;
grant execute on function public.authorize_data_figure_export(uuid,uuid,text) to service_role;

revoke all on function public.data_figure_wallet(uuid),
  public.reserve_data_figure(uuid,text,text,text,text,uuid), public.guard_data_figure_hold(),
  public.mark_data_figure_renderable(uuid,uuid,text,text,text),
  public.settle_data_figure(uuid,uuid,text,text,text) from public, anon, authenticated;
grant execute on function public.data_figure_wallet(uuid),
  public.reserve_data_figure(uuid,text,text,text,text,uuid),
  public.mark_data_figure_renderable(uuid,uuid,text,text,text),
  public.settle_data_figure(uuid,uuid,text,text,text) to service_role;

-- Existing Stripe accounting is unchanged except releasing an unfunded hold
-- before applying a reversal; negative balances and idempotency are preserved.
create or replace function public.admin_apply_stripe_event(
  p_event_id text,
  p_event_type text,
  p_adjustment_id text,
  p_payment_intent_id text,
  p_user_id uuid,
  p_bonus integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_count integer;
  transaction_row public.stripe_bonus_transactions%rowtype;
  v_desired_reversal integer := 0;
  v_reversal_delta integer := 0;
  v_wallet_delta integer := 0;
  target_user_id uuid;
  ledger_reason text;
  v_figure_wallet jsonb;
begin
  if p_event_type not in ('purchase', 'refund', 'dispute', 'dispute_reinstatement')
     or p_bonus < 1 or nullif(p_adjustment_id, '') is null then
    raise exception 'invalid_stripe_adjustment';
  end if;

  insert into public.stripe_webhook_events (
    event_id, event_type, adjustment_id, payment_intent_id, requested_bonus
  ) values (p_event_id, p_event_type, p_adjustment_id, p_payment_intent_id, p_bonus)
    on conflict do nothing;
  get diagnostics inserted_count = row_count;
  if inserted_count = 0 then
    return jsonb_build_object('applied', false, 'duplicate', true);
  end if;

  if p_event_type = 'purchase' then
    if p_user_id is null then raise exception 'stripe_user_required'; end if;
    insert into public.stripe_bonus_transactions (
      payment_intent_id, user_id, purchased_bonus
    ) values (p_payment_intent_id, p_user_id, p_bonus)
    on conflict (payment_intent_id) do nothing;
    get diagnostics inserted_count = row_count;
    if inserted_count = 0 then
      return jsonb_build_object('applied', false, 'duplicate_payment', true);
    end if;
    target_user_id := p_user_id;
    v_wallet_delta := p_bonus;
    ledger_reason := 'stripe_purchase';
  else
    select * into transaction_row from public.stripe_bonus_transactions
      where payment_intent_id = p_payment_intent_id for update;
    if transaction_row.payment_intent_id is null then raise exception 'stripe_purchase_not_found'; end if;
    target_user_id := transaction_row.user_id;

    if p_event_type = 'dispute_reinstatement' then
      update public.stripe_webhook_events
        set active = false
        where event_type = 'dispute'
          and adjustment_id = p_adjustment_id
          and payment_intent_id = p_payment_intent_id
          and active = true;
      get diagnostics inserted_count = row_count;
      if inserted_count = 0 then raise exception 'stripe_dispute_not_found'; end if;
      ledger_reason := 'stripe_reinstatement';
    else
      ledger_reason := case when p_event_type = 'refund' then 'stripe_refund' else 'stripe_dispute' end;
    end if;

    select least(
      transaction_row.purchased_bonus,
      coalesce(sum(requested_bonus), 0)::integer
    ) into v_desired_reversal
      from public.stripe_webhook_events
      where payment_intent_id = p_payment_intent_id
        and event_type in ('refund', 'dispute')
        and active = true;

    v_reversal_delta := v_desired_reversal - transaction_row.reversed_bonus;
    v_wallet_delta := -v_reversal_delta;
    update public.stripe_bonus_transactions
      set reversed_bonus = v_desired_reversal, updated_at = now()
      where payment_intent_id = p_payment_intent_id;
  end if;

  update public.stripe_webhook_events
    set applied_bonus = abs(v_wallet_delta)
    where event_id = p_event_id;

  if v_wallet_delta <> 0 then
    if v_wallet_delta < 0 then
      -- A financial reversal must not fail because a browser task has a hold.
      -- Lock profile BEFORE version rows, like every figure lifecycle RPC.
      v_figure_wallet := public.data_figure_wallet(target_user_id);
      if (v_figure_wallet->>'bonus_balance')::integer + v_wallet_delta
          < (v_figure_wallet->>'held_bonus')::integer then
        update public.member_data_figure_versions
          set status='cancelled', settled_at=clock_timestamp()
          where user_id=target_user_id and status in ('reserved','awaiting_render');
      end if;
    end if;
    update public.member_profiles
      set bonus_balance = bonus_balance + v_wallet_delta, updated_at = now()
      where user_id = target_user_id;
    insert into public.bonus_ledger (user_id, idempotency_key, delta, reason, metadata)
      values (
        target_user_id,
        'stripe:' || p_event_id,
        v_wallet_delta,
        ledger_reason,
        jsonb_build_object(
          'payment_intent_id', p_payment_intent_id,
          'stripe_event_id', p_event_id,
          'adjustment_id', p_adjustment_id
        )
      );
  end if;

  return jsonb_build_object(
    'applied', v_wallet_delta <> 0,
    'bonus_delta', v_wallet_delta,
    'user_id', target_user_id
  );
end;
$$;

revoke all on function public.admin_apply_stripe_event(text, text, text, text, uuid, integer)
  from public, anon, authenticated;
grant execute on function public.admin_apply_stripe_event(text, text, text, text, uuid, integer)
  to service_role;
