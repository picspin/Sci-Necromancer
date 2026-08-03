begin;
create extension if not exists pgtap with schema extensions;
select plan(28);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '00000000-0000-0000-0000-000000000000',
  '11111111-1111-4111-8111-111111111111',
  'authenticated', 'authenticated', 'member-v2@example.test', '', now(),
  '{"provider":"email","providers":["email"]}', '{}', now(), now()
);

select is(
  (select bonus_balance from public.member_profiles where user_id = '11111111-1111-4111-8111-111111111111'),
  0,
  'new profile begins at zero before verified-account bootstrap'
);
select is(
  (public.admin_claim_signup_bonus('11111111-1111-4111-8111-111111111111')->>'bonus_balance')::integer,
  5,
  'verified signup bootstrap grants five bonus'
);
select is(
  (public.admin_claim_signup_bonus('11111111-1111-4111-8111-111111111111')->>'bonus_balance')::integer,
  5,
  'signup bonus is idempotent'
);
select is(
  (public.check_in_bonus('11111111-1111-4111-8111-111111111111')->>'bonus_balance')::integer,
  6,
  'first check-in grants one bonus'
);
select is(
  (public.check_in_bonus('11111111-1111-4111-8111-111111111111')->>'bonus_balance')::integer,
  6,
  'same-day check-in is idempotent'
);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '00000000-0000-0000-0000-000000000000',
  '22222222-2222-4222-8222-222222222222',
  'authenticated', 'authenticated', 'cycle@example.test', '', now(),
  '{"provider":"email","providers":["email"]}', '{}', now(), now()
);
insert into public.member_daily_checkins (user_id, checkin_date)
select '22222222-2222-4222-8222-222222222222',
       timezone('Asia/Shanghai', now())::date - day_offset
from generate_series(0, 6) as checkin_days(day_offset);
select is(
  (public.member_status('22222222-2222-4222-8222-222222222222')->>'checkin_cycle')::integer,
  0,
  'a completed seven-day cycle is displayed as zero'
);
select is(
  (public.check_in_bonus('22222222-2222-4222-8222-222222222222')->>'checkin_cycle')::integer,
  0,
  'retrying a completed-day check-in remains at zero'
);
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '00000000-0000-0000-0000-000000000000',
  '33333333-3333-4333-8333-333333333333',
  'authenticated', 'authenticated', 'gap@example.test', '', now(),
  '{"provider":"email","providers":["email"]}', '{}', now(), now()
);
insert into public.member_daily_checkins (user_id, checkin_date) values
  ('33333333-3333-4333-8333-333333333333', timezone('Asia/Shanghai', now())::date),
  ('33333333-3333-4333-8333-333333333333', timezone('Asia/Shanghai', now())::date - 2);
select is(
  public.member_checkin_streak(
    '33333333-3333-4333-8333-333333333333', timezone('Asia/Shanghai', now())::date
  ),
  1,
  'a missing day stops the streak at the first gap'
);

update public.member_profiles set bonus_balance = 20
where user_id = '11111111-1111-4111-8111-111111111111';
select is(
  (public.upgrade_abstract_quota('11111111-1111-4111-8111-111111111111', 100)->>'charged')::integer,
  2,
  '30 to 100 costs two bonus'
);
select is(
  (public.upgrade_abstract_quota('11111111-1111-4111-8111-111111111111', 500)->>'charged')::integer,
  8,
  '100 to 500 costs the remaining eight bonus'
);
select is(
  (select abstract_quota from public.member_profiles where user_id = '11111111-1111-4111-8111-111111111111'),
  500,
  'quota upgrade is permanent on the member profile'
);

create temporary table workflow_test(task_id uuid);
insert into workflow_test
select (public.reserve_bonus_task(
  '11111111-1111-4111-8111-111111111111', 'workflow-v2-test', 'analysis_generation'
)->>'task_id')::uuid;
select is(
  (select call_count from public.managed_generation_tasks where id = (select task_id from workflow_test)),
  1,
  'analysis reservation is the first provider call'
);
select is(
  (select credit_cost from public.managed_generation_tasks where id = (select task_id from workflow_test)),
  2,
  'a managed abstract workflow reserves two credits'
);
select public.settle_bonus_task(
  '11111111-1111-4111-8111-111111111111', (select task_id from workflow_test), true, false
);
select public.continue_bonus_task(
  '11111111-1111-4111-8111-111111111111', (select task_id from workflow_test), 'generation'
);
select public.settle_bonus_task(
  '11111111-1111-4111-8111-111111111111', (select task_id from workflow_test), true, false
);
select public.continue_bonus_task(
  '11111111-1111-4111-8111-111111111111', (select task_id from workflow_test), 'regeneration'
);
select public.settle_bonus_task(
  '11111111-1111-4111-8111-111111111111', (select task_id from workflow_test), true, false
);
select throws_ok(
  format(
    'select public.continue_bonus_task(%L, %L, %L)',
    '11111111-1111-4111-8111-111111111111',
    (select task_id from workflow_test),
    'regeneration'
  ),
  'P0001', 'workflow_generation_limit',
  'a third generation is rejected before another provider call'
);
select public.continue_bonus_task(
  '11111111-1111-4111-8111-111111111111', (select task_id from workflow_test), 'deep_update'
);
select public.settle_bonus_task(
  '11111111-1111-4111-8111-111111111111', (select task_id from workflow_test), true, false
);
select is(
  (select call_count from public.managed_generation_tasks where id = (select task_id from workflow_test)),
  4,
  'analysis, two generations, and one deep update use four calls'
);
select is(
  (select status from public.managed_generation_tasks where id = (select task_id from workflow_test)),
  'completed',
  'the fully used workflow closes automatically'
);

create temporary table expired_without_output_test(task_id uuid, balance_before integer);
insert into expired_without_output_test
select
  (reservation->>'task_id')::uuid,
  (reservation->>'bonus_balance')::integer + 2
from (
  select public.reserve_bonus_task(
    '11111111-1111-4111-8111-111111111111',
    'expired-without-output-v2-test',
    'analysis_generation'
  ) as reservation
) reserved;
select public.settle_bonus_task(
  '11111111-1111-4111-8111-111111111111',
  (select task_id from expired_without_output_test),
  true,
  false
);
update public.managed_generation_tasks
set updated_at = now() - interval '31 minutes'
where id = (select task_id from expired_without_output_test);
select public.recover_stale_tasks('11111111-1111-4111-8111-111111111111');
select is(
  (select status from public.managed_generation_tasks
   where id = (select task_id from expired_without_output_test)),
  'refunded',
  'an expired analysis workflow with no generated abstract is refunded'
);
select is(
  (select bonus_balance from public.member_profiles
   where user_id = '11111111-1111-4111-8111-111111111111'),
  (select balance_before from expired_without_output_test),
  'an expired workflow without a deliverable refunds its exact two-credit reservation'
);

create temporary table failed_without_output_test(task_id uuid, balance_before integer);
insert into failed_without_output_test
select
  (reservation->>'task_id')::uuid,
  (reservation->>'bonus_balance')::integer + 2
from (
  select public.reserve_bonus_task(
    '11111111-1111-4111-8111-111111111111',
    'failed-without-output-v2-test',
    'analysis_generation'
  ) as reservation
) reserved;
select public.settle_bonus_task(
  '11111111-1111-4111-8111-111111111111',
  (select task_id from failed_without_output_test),
  true,
  false
);
select public.continue_bonus_task(
  '11111111-1111-4111-8111-111111111111',
  (select task_id from failed_without_output_test),
  'generation'
);
select public.settle_bonus_task(
  '11111111-1111-4111-8111-111111111111',
  (select task_id from failed_without_output_test),
  false,
  false
);
select is(
  (select status from public.managed_generation_tasks
   where id = (select task_id from failed_without_output_test)),
  'refunded',
  'a failed initial generation refunds a workflow that produced no abstract'
);
select is(
  (select bonus_balance from public.member_profiles
   where user_id = '11111111-1111-4111-8111-111111111111'),
  (select balance_before from failed_without_output_test),
  'a failed initial generation immediately refunds its exact two-credit reservation'
);

select is(
  (public.reserve_bonus_task(
    '11111111-1111-4111-8111-111111111111', 'blind-review-v2-test', 'blind_review'
  )->>'charged')::boolean,
  true,
  'blind review is a separately charged managed task'
);
select is(
  (select credit_cost from public.managed_generation_tasks where idempotency_key = 'blind-review-v2-test'),
  1,
  'blind review reserves one credit'
);
select public.settle_bonus_task(
  '11111111-1111-4111-8111-111111111111',
  (select id from public.managed_generation_tasks where idempotency_key = 'blind-review-v2-test'),
  true,
  true
);
select is(
  (select status from public.managed_generation_tasks where idempotency_key = 'blind-review-v2-test'),
  'completed',
  'blind review completes after one deliverable call'
);

update public.member_profiles set abstract_quota = 30
where user_id = '11111111-1111-4111-8111-111111111111';
select public.save_member_abstract(
  '11111111-1111-4111-8111-111111111111',
  'abstract-' || item,
  'Title ' || item,
  'RSNA',
  '{"abstractType":"RSNA Science Abstract","abstractData":{"abstract":"x"},"keywords":[]}',
  null
) from generate_series(1, 30) as item;
select throws_ok(
  $$select public.save_member_abstract(
    '11111111-1111-4111-8111-111111111111', 'abstract-31', 'Title 31', 'RSNA',
    '{"abstractType":"RSNA Science Abstract","abstractData":{"abstract":"x"},"keywords":[]}', null
  )$$,
  'P0001', 'abstract_quota_exceeded',
  'the database rejects a thirty-first base-tier abstract'
);

create temporary table refund_test(task_id uuid, balance_before integer);
insert into refund_test
select
  (reservation->>'task_id')::uuid,
  (reservation->>'bonus_balance')::integer + 2
from (
  select public.reserve_bonus_task(
    '11111111-1111-4111-8111-111111111111', 'refund-v2-test', 'image_generation'
  ) as reservation
) reserved;
select is(
  (select credit_cost from public.managed_generation_tasks where id = (select task_id from refund_test)),
  2,
  'managed image generation reserves two credits'
);
select public.settle_bonus_task(
  '11111111-1111-4111-8111-111111111111', (select task_id from refund_test), false, true
);
select is(
  (select bonus_balance from public.member_profiles where user_id = '11111111-1111-4111-8111-111111111111'),
  (select balance_before from refund_test),
  'a failed first provider call refunds its reserved bonus'
);
select throws_ok(
  $$select public.reserve_bonus_task(
    '11111111-1111-4111-8111-111111111111', 'refund-v2-test', 'image_generation'
  )$$,
  'P0001', 'idempotency_key_refunded',
  'a refunded idempotency key cannot be charged again'
);
select throws_ok(
  $$select public.save_member_abstract(
    '11111111-1111-4111-8111-111111111111', 'oversize', 'Oversize', 'RSNA',
    jsonb_build_object('content', repeat('x', 10001)), null
  )$$,
  'P0001', 'abstract_too_large',
  'abstract payloads over ten kilobytes are rejected in the database'
);

select * from finish();
rollback;
