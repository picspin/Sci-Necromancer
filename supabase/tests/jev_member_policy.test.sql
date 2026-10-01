-- Run against a local Supabase database with all migrations applied:
-- supabase test db supabase/tests/jev_member_policy.test.sql
-- Fixtures and reservation effects are rolled back at the end.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(14);

create temporary table jev_policy_fixture as
select gen_random_uuid() as user_id, clock_timestamp() as base_at, null::jsonb as result;

insert into auth.users (id, aud, role, email)
select user_id, 'authenticated', 'authenticated', user_id::text || '@example.test'
from jev_policy_fixture;
update public.member_profiles set bonus_balance = 10
where user_id = (select user_id from jev_policy_fixture);
select public.jev_set_consent(
  (select user_id from jev_policy_fixture), 'typesafe-member-2026-09-21-v1', true
);

select is(
  public.jev_reserve_analysis(
    (select user_id from jev_policy_fixture), 'typesafe-member-2026-09-21-v1', repeat('a', 64)
  )->>'status', 'reserved', 'first analysis is reserved'
);
select is(
  public.jev_reserve_analysis(
    (select user_id from jev_policy_fixture), 'typesafe-member-2026-09-21-v1', repeat('b', 64)
  )->>'status', 'reserved', 'second analysis is reserved'
);
select is(
  public.jev_reserve_analysis(
    (select user_id from jev_policy_fixture), 'typesafe-member-2026-09-21-v1', repeat('c', 64)
  )->>'status', 'reserved', 'third analysis is reserved'
);
update jev_policy_fixture set result = public.jev_reserve_analysis(
  user_id, 'typesafe-member-2026-09-21-v1', repeat('f', 64)
);
select is((select result->>'status' from jev_policy_fixture), 'limited', 'fourth analysis is limited');
select is(
  (select (result->>'retry_at')::timestamptz from jev_policy_fixture),
  (select min(created_at) + interval '1 minute' from public.member_jev_analysis_attempts
   where user_id = (select user_id from jev_policy_fixture)),
  'minute-only limit returns the first minute slot expiry'
);
select is(
  (select count(*) from public.member_jev_analysis_attempts
   where user_id = (select user_id from jev_policy_fixture)),
  3::bigint, 'limited call creates no fourth reservation'
);
select is(
  (select bonus_balance from public.member_profiles
   where user_id = (select user_id from jev_policy_fixture)),
  10, 'analysis reservations and limiting leave the wallet unchanged'
);
select is(
  (select count(*) from public.bonus_ledger
   where user_id = (select user_id from jev_policy_fixture)),
  0::bigint, 'analysis reservations and limiting create no credit ledger entries'
);

delete from public.member_jev_analysis_attempts
where user_id = (select user_id from jev_policy_fixture);
insert into public.member_jev_analysis_attempts(user_id, cache_key, status, created_at, lease_expires_at)
select user_id, repeat(md5(n::text), 2), 'completed',
       base_at - interval '2 hours' - n * interval '1 minute', base_at + interval '90 seconds'
from jev_policy_fixture cross join generate_series(1, 30) as attempts(n);
update jev_policy_fixture set result = public.jev_reserve_analysis(
  user_id, 'typesafe-member-2026-09-21-v1', repeat('f', 64)
);
select is((select result->>'status' from jev_policy_fixture), 'limited', 'daily-only limit blocks a new analysis');
select is(
  (select (result->>'retry_at')::timestamptz from jev_policy_fixture),
  (select min(created_at) + interval '24 hours' from public.member_jev_analysis_attempts
   where user_id = (select user_id from jev_policy_fixture)),
  'daily-only limit returns the first rolling-day slot expiry'
);
select is((select (result->>'remaining')::integer from jev_policy_fixture), 0, 'daily limit reports zero remaining');

update public.member_jev_analysis_attempts set status = 'pending',
  lease_expires_at = (select base_at + interval '90 seconds' from jev_policy_fixture)
where user_id = (select user_id from jev_policy_fixture);
update public.member_jev_analysis_attempts
set lease_expires_at = (select base_at + interval '60 seconds' from jev_policy_fixture)
where user_id = (select user_id from jev_policy_fixture) and cache_key = repeat(md5('1'), 2);
update jev_policy_fixture set result = public.jev_reserve_analysis(
  user_id, 'typesafe-member-2026-09-21-v1', repeat('f', 64)
);
select is(
  (select (result->>'retry_at')::timestamptz from jev_policy_fixture),
  (select base_at + interval '60 seconds' from jev_policy_fixture),
  'pending daily reservations release capacity when the first lease expires'
);

update public.member_jev_analysis_attempts set status = 'completed'
where user_id = (select user_id from jev_policy_fixture);
update public.member_jev_analysis_attempts
set created_at = (select base_at - interval '15 seconds' from jev_policy_fixture)
where user_id = (select user_id from jev_policy_fixture)
  and cache_key in (repeat(md5('28'), 2), repeat(md5('29'), 2), repeat(md5('30'), 2));
update jev_policy_fixture set result = public.jev_reserve_analysis(
  user_id, 'typesafe-member-2026-09-21-v1', repeat('f', 64)
);
select is(
  (select (result->>'retry_at')::timestamptz from jev_policy_fixture),
  (select min(created_at) + interval '24 hours' from public.member_jev_analysis_attempts
   where user_id = (select user_id from jev_policy_fixture)),
  'when both limits apply, a later daily retry wins'
);
update public.member_jev_analysis_attempts set status = 'pending',
  lease_expires_at = (select base_at + interval '30 seconds' from jev_policy_fixture)
where user_id = (select user_id from jev_policy_fixture);
update jev_policy_fixture set result = public.jev_reserve_analysis(
  user_id, 'typesafe-member-2026-09-21-v1', repeat('f', 64)
);
select is(
  (select (result->>'retry_at')::timestamptz from jev_policy_fixture),
  (select base_at + interval '45 seconds' from jev_policy_fixture),
  'when both limits apply, a later minute retry wins over the pending lease expiry'
);

select * from finish();
rollback;
