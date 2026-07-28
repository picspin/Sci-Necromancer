create table if not exists public.stripe_bonus_transactions (
  payment_intent_id text primary key,
  user_id uuid not null references auth.users(id) on delete restrict,
  purchased_bonus integer not null check (purchased_bonus > 0),
  reversed_bonus integer not null default 0 check (reversed_bonus >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (reversed_bonus <= purchased_bonus)
);

create table if not exists public.stripe_webhook_events (
  event_id text primary key,
  event_type text not null check (event_type in ('purchase', 'refund', 'dispute', 'dispute_reinstatement')),
  adjustment_id text not null,
  payment_intent_id text not null,
  requested_bonus integer not null check (requested_bonus > 0),
  applied_bonus integer not null default 0 check (applied_bonus >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (event_type, adjustment_id)
);

alter table public.stripe_bonus_transactions enable row level security;
alter table public.stripe_webhook_events enable row level security;

create policy "members read own stripe purchases" on public.stripe_bonus_transactions
  for select using (auth.uid() = user_id);

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
