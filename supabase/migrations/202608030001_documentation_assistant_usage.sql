create table if not exists public.help_assistant_usage (
  subject_hash text not null,
  usage_date date not null default ((timezone('Asia/Shanghai', now()))::date),
  request_key text not null,
  status text not null default 'reserved' check (status in ('reserved', 'succeeded', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (subject_hash, usage_date, request_key)
);

create index if not exists help_assistant_usage_daily_idx
  on public.help_assistant_usage (subject_hash, usage_date, status);

alter table public.help_assistant_usage enable row level security;

create or replace function public.reserve_help_assistant_usage(
  p_subject_hash text,
  p_request_key text,
  p_daily_limit integer,
  p_turnstile_verified boolean
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_date_shanghai date := (timezone('Asia/Shanghai', now()))::date;
  existing_status text;
  active_count integer;
begin
  if length(p_subject_hash) <> 64 or length(p_request_key) < 8 or length(p_request_key) > 200
     or p_daily_limit not in (3, 20) then
    raise exception 'invalid_help_usage_request';
  end if;

  -- Serialize reservations for one subject/day so concurrent requests cannot exceed the limit.
  perform pg_advisory_xact_lock(
    hashtextextended(p_subject_hash || ':' || current_date_shanghai::text, 0)
  );

  update public.help_assistant_usage
     set status = 'failed', updated_at = now()
   where subject_hash = p_subject_hash
     and usage_date = current_date_shanghai
     and status = 'reserved'
     and created_at < now() - interval '5 minutes';

  select status into existing_status
    from public.help_assistant_usage
   where subject_hash = p_subject_hash
     and usage_date = current_date_shanghai
     and request_key = p_request_key;

  select count(*) into active_count
    from public.help_assistant_usage
   where subject_hash = p_subject_hash
     and usage_date = current_date_shanghai
     and status in ('reserved', 'succeeded');

  if existing_status in ('reserved', 'succeeded') then
    return jsonb_build_object(
      'allowed', true,
      'remaining', greatest(p_daily_limit - active_count, 0),
      'idempotent', true
    );
  end if;

  if p_daily_limit = 3 and active_count = 0 and not p_turnstile_verified then
    return jsonb_build_object(
      'allowed', false,
      'remaining', p_daily_limit,
      'requiresTurnstile', true,
      'idempotent', false
    );
  end if;

  if active_count >= p_daily_limit then
    return jsonb_build_object(
      'allowed', false,
      'remaining', 0,
      'requiresTurnstile', false,
      'idempotent', false
    );
  end if;

  insert into public.help_assistant_usage(subject_hash, usage_date, request_key, status)
  values (p_subject_hash, current_date_shanghai, p_request_key, 'reserved')
  on conflict (subject_hash, usage_date, request_key)
  do update set status = 'reserved', created_at = now(), updated_at = now();

  return jsonb_build_object(
    'allowed', true,
    'remaining', greatest(p_daily_limit - active_count - 1, 0),
    'requiresTurnstile', false,
    'idempotent', false
  );
end;
$$;

create or replace function public.settle_help_assistant_usage(
  p_subject_hash text,
  p_request_key text,
  p_succeeded boolean
) returns void
language sql
security definer
set search_path = public
as $$
  update public.help_assistant_usage
     set status = case when p_succeeded then 'succeeded' else 'failed' end,
         updated_at = now()
   where subject_hash = p_subject_hash
     and usage_date = (timezone('Asia/Shanghai', now()))::date
     and request_key = p_request_key;
$$;

revoke all on table public.help_assistant_usage from public, anon, authenticated;
revoke all on function public.reserve_help_assistant_usage(text, text, integer, boolean) from public, anon, authenticated;
revoke all on function public.settle_help_assistant_usage(text, text, boolean) from public, anon, authenticated;
grant execute on function public.reserve_help_assistant_usage(text, text, integer, boolean) to service_role;
grant execute on function public.settle_help_assistant_usage(text, text, boolean) to service_role;
