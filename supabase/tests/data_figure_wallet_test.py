"""Real PostgreSQL regression; isolated auth fixture, not a Supabase/Auth E2E.

Run using the pinned, temporary test tools documented in the implementation card.
Never accepts a database URL: it creates its own local cluster and stops it at exit.
"""

from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from tempfile import TemporaryDirectory
from threading import Barrier
import unittest
from uuid import uuid4

import pgserver
import psycopg


ROOT = Path(__file__).resolve().parents[2]


class FigureWalletTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = TemporaryDirectory(prefix="sci-figure-wallet-")
        cls.pg = pgserver.get_server(Path(cls.tmp.name) / "db", cleanup_mode="stop")
        cls.addClassCleanup(cls.tmp.cleanup)
        cls.addClassCleanup(cls.pg.cleanup)
        cls.uri = cls.pg.get_uri()
        with psycopg.connect(cls.uri, autocommit=True) as conn:
            # Minimal local Auth shape needed by the actual checked-in migrations.
            # No GoTrue, JWT verifier, hosted Supabase or external users are used.
            conn.execute("""
                create role anon; create role authenticated;
                create role service_role bypassrls;
                create schema auth;
                create table auth.users(id uuid primary key, email_confirmed_at timestamptz);
                create function auth.uid() returns uuid language sql stable as
                $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
                grant usage on schema auth to authenticated;
            """)
            for migration in sorted((ROOT / "supabase/migrations").glob("*.sql")):
                # This binary distribution lacks pgcrypto. These migrations only
                # use gen_random_uuid(), built into PostgreSQL 16; no crypto stub.
                sql = migration.read_text().replace(
                    "create extension if not exists pgcrypto;", "-- builtin gen_random_uuid()"
                )
                conn.execute(sql)

    def setUp(self):
        self.conn = psycopg.connect(self.uri, autocommit=True)
        self.addCleanup(self.conn.close)
        self.user = uuid4()
        self.conn.execute("insert into auth.users(id) values (%s)", (self.user,))
        self.conn.execute("update member_profiles set bonus_balance=3 where user_id=%s", (self.user,))

    def rpc(self, name, *args, conn=None):
        return (conn or self.conn).execute(
            f"select public.{name}({','.join(['%s'] * len(args))})", args
        ).fetchone()[0]

    def reserve(self, key="first", model="deepseek-v4.1-flash", parent=None, conn=None):
        return self.rpc("reserve_data_figure", self.user, key, "a" * 64, "b" * 64,
                        model, parent, conn=conn)

    def balance(self):
        return self.conn.execute("select bonus_balance from member_profiles where user_id=%s",
                                 (self.user,)).fetchone()[0]

    def test_reservation_does_not_charge_or_create_ledger(self):
        result = self.reserve()
        self.assertEqual(result["status"], "reserved")
        self.assertEqual(result["available_bonus"], 2)
        self.assertEqual(self.balance(), 3)
        self.assertEqual(self.conn.execute("select count(*) from bonus_ledger where user_id=%s",
                                          (self.user,)).fetchone()[0], 0)

    def test_same_key_is_idempotent_but_different_input_conflicts(self):
        first = self.reserve()
        self.assertEqual(self.reserve()["id"], first["id"])
        with self.assertRaisesRegex(psycopg.Error, "data_figure_idempotency_conflict"):
            self.reserve(model="gpt-5.6-terra")

    def ready(self, version):
        return self.rpc("mark_data_figure_renderable", self.user, version["id"],
                        "c" * 64, "mga", "actual-upstream-model")

    def settle(self, version, outcome="completed", conn=None):
        return self.rpc("settle_data_figure", self.user, version["id"], outcome,
                        "c" * 64, "d" * 64, conn=conn)

    def test_completed_render_charges_once_and_preserves_actual_model(self):
        version = self.ready(self.reserve())
        self.assertEqual(self.balance(), 3)
        self.assertEqual(version["actual_model"], "actual-upstream-model")
        self.assertEqual(self.settle(version)["status"], "completed")
        self.assertEqual(self.balance(), 2)
        self.settle(version)
        self.assertEqual(self.balance(), 2)
        ledger = self.conn.execute("select delta,reason,metadata from bonus_ledger where user_id=%s",
                                   (self.user,)).fetchall()
        self.assertEqual(len(ledger), 1)
        self.assertEqual(ledger[0][:2], (-1, "generation"))
        self.assertEqual(ledger[0][2]["area"], "data_figure")
        self.assertEqual(ledger[0][2]["actual_model"], "actual-upstream-model")

    def test_reserved_is_not_renderable_and_bad_hash_cannot_complete(self):
        version = self.reserve()
        with self.assertRaisesRegex(psycopg.Error, "data_figure_not_renderable"):
            self.settle(version)
        self.ready(version)
        with self.assertRaisesRegex(psycopg.Error, "data_figure_spec_conflict"):
            self.rpc("settle_data_figure", self.user, version["id"], "completed", "e" * 64, "d" * 64)
        self.assertEqual(self.balance(), 3)

    def test_cancel_failure_and_expiry_release_without_charge(self):
        for outcome in ("cancelled", "failed", "expired"):
            with self.subTest(outcome=outcome):
                version = self.reserve(key=outcome)
                if outcome == "expired":
                    self.conn.execute("update member_data_figure_versions set lease_expires_at=now()-interval '1 second' where id=%s",
                                      (version["id"],))
                result = self.settle(version, outcome if outcome != "expired" else "completed")
                self.assertEqual(result["status"], outcome)
                self.assertEqual(result["held_bonus"], 0)
                self.assertEqual(self.balance(), 3)
                self.assertEqual(self.settle(version)["status"], outcome)

    def test_other_spenders_cannot_spend_held_credit(self):
        self.conn.execute("update member_profiles set bonus_balance=1 where user_id=%s", (self.user,))
        self.reserve()
        with self.assertRaisesRegex(psycopg.Error, "insufficient_bonus"):
            self.rpc("reserve_bonus_task", self.user, "competing-review", "blind_review")
        with self.assertRaisesRegex(psycopg.Error, "insufficient_bonus"):
            self.conn.execute("update member_profiles set bonus_balance=0 where user_id=%s", (self.user,))
        self.assertEqual(self.balance(), 1)

    def test_one_active_version_and_failed_attempts_count_toward_limit(self):
        first = self.reserve()
        with self.assertRaisesRegex(psycopg.Error, "data_figure_busy"):
            self.reserve("other")
        self.settle(first, "failed")
        for n in range(1, 20):
            self.settle(self.reserve(str(n)), "failed")
        with self.assertRaisesRegex(psycopg.Error, "data_figure_rate_limited"):
            self.reserve("attempt-21")
        self.assertEqual(self.balance(), 3)

    def test_actual_model_and_spec_are_immutable_once_ready(self):
        version = self.ready(self.reserve())
        self.assertEqual(self.ready(version)["id"], version["id"])
        with self.assertRaisesRegex(psycopg.Error, "data_figure_plan_conflict"):
            self.rpc("mark_data_figure_renderable", self.user, version["id"],
                     "c" * 64, "mga", "different-model")

    def test_cross_user_cannot_mark_or_settle(self):
        version = self.reserve()
        stranger = uuid4()
        self.conn.execute("insert into auth.users(id) values (%s)", (stranger,))
        with self.assertRaisesRegex(psycopg.Error, "data_figure_not_found"):
            self.rpc("mark_data_figure_renderable", stranger, version["id"], "c" * 64, "mga", "model")
        with self.assertRaisesRegex(psycopg.Error, "data_figure_not_found"):
            self.rpc("settle_data_figure", stranger, version["id"], "cancelled", None, None)

    def test_refund_can_create_debt_and_cancels_unfunded_hold(self):
        self.rpc("admin_apply_stripe_event", "purchase-" + str(self.user), "purchase",
                 "purchase-" + str(self.user), str(self.user), self.user, 5)
        # Purchase remains 5; previous spending left only 1 before the new hold.
        self.conn.execute("update member_profiles set bonus_balance=1 where user_id=%s", (self.user,))
        version = self.ready(self.reserve())
        result = self.rpc("admin_apply_stripe_event", "refund-" + str(self.user), "refund",
                          "refund-" + str(self.user), str(self.user), None, 5)
        self.assertEqual(result["bonus_delta"], -5)
        self.assertEqual(self.balance(), -4)
        self.assertEqual(self.settle(version)["status"], "cancelled")
        self.assertEqual(self.balance(), -4)
        self.assertFalse(self.rpc("admin_apply_stripe_event", "refund-" + str(self.user), "refund",
                                 "refund-" + str(self.user), str(self.user), None, 5)["applied"])

    def test_funded_refund_keeps_hold_and_expired_hold_does_not_block_spend(self):
        self.rpc("admin_apply_stripe_event", "purchase-" + str(self.user), "purchase",
                 "purchase-" + str(self.user), str(self.user), self.user, 5)
        version = self.reserve()
        self.rpc("admin_apply_stripe_event", "refund-" + str(self.user), "refund",
                 "refund-" + str(self.user), str(self.user), None, 5)
        self.assertEqual(self.reserve()["status"], "reserved")
        self.conn.execute("update member_data_figure_versions set lease_expires_at=now()-interval '1 second' where id=%s",
                          (version["id"],))
        self.conn.execute("update member_profiles set bonus_balance=0 where user_id=%s", (self.user,))
        self.assertEqual(self.rpc("data_figure_wallet", self.user)["held_bonus"], 0)

    def test_zero_balance_completed_version_can_authorize_all_free_formats(self):
        self.conn.execute("update member_profiles set bonus_balance=1 where user_id=%s", (self.user,))
        version = self.ready(self.reserve())
        self.settle(version)
        for fmt in ("png", "pdf", "svg", "reproducibility"):
            result = self.rpc("authorize_data_figure_export", self.user, version["id"], fmt)
            self.assertEqual(result["id"], version["id"])
            self.assertEqual(result["extra_credit_cost"], 0)
        self.assertEqual(self.balance(), 0)
        self.assertEqual(self.conn.execute("select count(*) from bonus_ledger where user_id=%s",
                                          (self.user,)).fetchone()[0], 1)

    def test_incomplete_foreign_version_or_unknown_format_cannot_export(self):
        version = self.reserve()
        with self.assertRaisesRegex(psycopg.Error, "data_figure_export_unavailable"):
            self.rpc("authorize_data_figure_export", self.user, version["id"], "png")
        self.ready(version)
        self.settle(version)
        with self.assertRaisesRegex(psycopg.Error, "invalid_data_figure_format"):
            self.rpc("authorize_data_figure_export", self.user, version["id"], "python")
        with self.assertRaisesRegex(psycopg.Error, "data_figure_export_unavailable"):
            self.rpc("authorize_data_figure_export", uuid4(), version["id"], "png")

    def race(self, left, right):
        barrier = Barrier(2)
        def run(action):
            with psycopg.connect(self.uri, autocommit=True) as conn:
                conn.execute("set statement_timeout='5s'")
                barrier.wait(timeout=5)
                try:
                    return action(conn)
                except psycopg.Error as exc:
                    return exc
        with ThreadPoolExecutor(max_workers=2) as pool:
            a, b = pool.submit(run, left), pool.submit(run, right)
            return a.result(timeout=10), b.result(timeout=10)

    def test_concurrent_reservations_create_one_hold(self):
        results = self.race(lambda c: self.reserve("left", conn=c),
                            lambda c: self.reserve("right", conn=c))
        self.assertEqual(sum(isinstance(r, dict) for r in results), 1)
        self.assertTrue(any("data_figure_busy" in str(r) for r in results))
        self.assertEqual(self.rpc("data_figure_wallet", self.user)["held_bonus"], 1)

    def test_concurrent_completion_charges_exactly_once(self):
        version = self.ready(self.reserve())
        results = self.race(lambda c: self.settle(version, conn=c),
                            lambda c: self.settle(version, conn=c))
        self.assertTrue(all(isinstance(r, dict) and r["status"] == "completed" for r in results))
        self.assertEqual(self.balance(), 2)

    def test_completion_cancel_race_never_double_spends(self):
        version = self.ready(self.reserve())
        results = self.race(lambda c: self.settle(version, conn=c),
                            lambda c: self.settle(version, "cancelled", conn=c))
        self.assertTrue(all(isinstance(r, dict) for r in results))
        self.assertEqual(results[0]["status"], results[1]["status"])
        self.assertEqual(self.balance(), 2 if results[0]["status"] == "completed" else 3)

    def test_old_spender_and_reservation_race_cannot_overdraw(self):
        self.conn.execute("update member_profiles set bonus_balance=1 where user_id=%s", (self.user,))
        results = self.race(lambda c: self.reserve(conn=c), lambda c:
                            self.rpc("reserve_bonus_task", self.user, "old", "blind_review", conn=c))
        self.assertEqual(sum(isinstance(r, dict) for r in results), 1)
        self.assertTrue(any("insufficient_bonus" in str(r) for r in results))
        wallet = self.rpc("data_figure_wallet", self.user)
        self.assertEqual(wallet["available_bonus"], 0)

    def test_last_held_credit_blocks_text_continue_and_storage_upgrade(self):
        workflow = self.rpc("reserve_bonus_task", self.user, "text-workflow", "analysis_generation")
        self.rpc("settle_bonus_task", self.user, workflow["task_id"], True, False)
        self.conn.execute("update member_profiles set bonus_balance=2 where user_id=%s", (self.user,))
        self.reserve()
        with self.assertRaisesRegex(psycopg.Error, "insufficient_bonus"):
            self.rpc("upgrade_abstract_quota", self.user, 100)
        self.rpc("continue_bonus_task", self.user, workflow["task_id"], "generation")
        self.rpc("settle_bonus_task", self.user, workflow["task_id"], True, False)
        with self.assertRaisesRegex(psycopg.Error, "insufficient_bonus"):
            self.rpc("continue_bonus_task", self.user, workflow["task_id"], "deep_update")
        self.assertEqual(self.balance(), 1)

    def test_invalid_inputs_and_foreign_parent_fail_without_holding_balance(self):
        for key, request_hash, model in (("", "a" * 64, "gpt-5.6-terra"),
                                         (" " * 3, "a" * 64, "gpt-5.6-terra"),
                                         ("x" * 129, "a" * 64, "gpt-5.6-terra"),
                                         ("key", "not-a-hash", "gpt-5.6-terra"),
                                         ("key", "a" * 64, "unknown-model")):
            with self.subTest(key=key, model=model):
                with self.assertRaisesRegex(psycopg.Error, "invalid_data_figure_request"):
                    self.rpc("reserve_data_figure", self.user, key, request_hash, "b" * 64, model, None)
        with self.assertRaisesRegex(psycopg.Error, "data_figure_parent_not_found"):
            self.reserve(parent=uuid4())
        self.assertEqual(self.rpc("data_figure_wallet", self.user)["held_bonus"], 0)

    def test_completed_version_is_valid_parent_for_new_chargeable_revision(self):
        parent = self.ready(self.reserve())
        self.settle(parent)
        child = self.ready(self.reserve("revision", parent=parent["id"], model="gpt-5.6-terra"))
        self.assertEqual(child["parent_id"], parent["id"])
        self.settle(child)
        self.assertEqual(self.balance(), 1)

    def test_no_credit_member_cannot_reserve_but_terminal_replay_still_works(self):
        self.conn.execute("update member_profiles set bonus_balance=0 where user_id=%s", (self.user,))
        with self.assertRaisesRegex(psycopg.Error, "insufficient_bonus"):
            self.reserve()
        self.conn.execute("update member_profiles set bonus_balance=1 where user_id=%s", (self.user,))
        version = self.ready(self.reserve())
        self.settle(version)
        self.assertEqual(self.reserve()["status"], "completed")

    def test_same_completed_version_cannot_accept_another_receipt(self):
        version = self.ready(self.reserve())
        self.settle(version)
        with self.assertRaisesRegex(psycopg.Error, "data_figure_receipt_conflict"):
            self.rpc("settle_data_figure", self.user, version["id"], "completed", "c" * 64, "e" * 64)
        self.assertEqual(self.balance(), 2)

    def test_new_reservation_expires_old_hold_without_charging(self):
        old = self.reserve()
        self.conn.execute("update member_data_figure_versions set lease_expires_at=now()-interval '1 second' where id=%s",
                          (old["id"],))
        new = self.reserve("new")
        self.assertNotEqual(old["id"], new["id"])
        self.assertEqual(self.settle(old)["status"], "expired")
        self.assertEqual(self.balance(), 3)

    def test_snapshot_isolation_old_spender_retries_instead_of_spending_hold(self):
        self.conn.execute("update member_profiles set bonus_balance=1 where user_id=%s", (self.user,))
        with psycopg.connect(self.uri, autocommit=True) as old:
            old.execute("begin isolation level repeatable read")
            old.execute("select bonus_balance from member_profiles where user_id=%s", (self.user,))
            self.reserve()
            with self.assertRaises(psycopg.errors.SerializationFailure):
                self.rpc("reserve_bonus_task", self.user, "old-snapshot", "blind_review", conn=old)
            old.execute("rollback")
        self.assertEqual(self.balance(), 1)

    def test_rls_owner_read_and_rpc_write_permissions(self):
        version = self.reserve()
        with psycopg.connect(self.uri, autocommit=True) as member:
            member.execute("set role authenticated")
            member.execute("select set_config('request.jwt.claim.sub',%s,false)", (str(self.user),))
            self.assertEqual(member.execute("select id::text from member_data_figure_versions").fetchall(),
                             [(version["id"],)])
            member.execute("select set_config('request.jwt.claim.sub',%s,false)", (str(uuid4()),))
            self.assertEqual(member.execute("select id from member_data_figure_versions").fetchall(), [])
            with self.assertRaises(psycopg.errors.InsufficientPrivilege):
                self.rpc("settle_data_figure", self.user, version["id"], "cancelled", None, None, conn=member)
            with self.assertRaises(psycopg.errors.InsufficientPrivilege):
                member.execute("update member_data_figure_versions set status='completed'")
        for role in ("anon", "authenticated"):
            for signature in ("data_figure_wallet(uuid)", "reserve_data_figure(uuid,text,text,text,text,uuid)",
                              "mark_data_figure_renderable(uuid,uuid,text,text,text)",
                              "settle_data_figure(uuid,uuid,text,text,text)",
                              "authorize_data_figure_export(uuid,uuid,text)"):
                self.assertFalse(self.conn.execute("select has_function_privilege(%s,%s,'execute')",
                                                   (role, "public." + signature)).fetchone()[0])

    def test_service_role_uses_rpc_not_direct_table_writes(self):
        with psycopg.connect(self.uri, autocommit=True) as service:
            service.execute("set role service_role")
            version = self.reserve(conn=service)
            self.assertEqual(version["status"], "reserved")
            with self.assertRaises(psycopg.errors.InsufficientPrivilege):
                service.execute("update member_data_figure_versions set status='cancelled' where id=%s",
                                (version["id"],))

    def test_refund_completion_race_preserves_financial_reversal(self):
        self.rpc("admin_apply_stripe_event", "purchase-" + str(self.user), "purchase",
                 "purchase-" + str(self.user), str(self.user), self.user, 5)
        self.conn.execute("update member_profiles set bonus_balance=1 where user_id=%s", (self.user,))
        version = self.ready(self.reserve())
        results = self.race(lambda c: self.settle(version, conn=c), lambda c: self.rpc(
            "admin_apply_stripe_event", "refund-" + str(self.user), "refund",
            "refund-" + str(self.user), str(self.user), None, 5, conn=c))
        self.assertTrue(all(isinstance(r, dict) for r in results))
        self.assertEqual(results[1]["bonus_delta"], -5)
        self.assertEqual(self.balance(), -5 if results[0]["status"] == "completed" else -4)

    def test_invalid_receipt_cannot_charge_and_key_length_uses_raw_input(self):
        with self.assertRaisesRegex(psycopg.Error, "invalid_data_figure_request"):
            self.reserve("k" * 128 + " ")
        version = self.ready(self.reserve())
        with self.assertRaisesRegex(psycopg.Error, "invalid_data_figure_receipt"):
            self.rpc("settle_data_figure", self.user, version["id"], "completed", "c" * 64, "not-a-hash")
        self.assertEqual(self.balance(), 3)

    def test_dispute_reinstatement_restores_money_without_resurrecting_cancelled_hold(self):
        uid = str(self.user)
        self.rpc("admin_apply_stripe_event", "buy-" + uid, "purchase", "buy-" + uid, uid, self.user, 5)
        self.conn.execute("update member_profiles set bonus_balance=1 where user_id=%s", (self.user,))
        version = self.ready(self.reserve())
        self.rpc("admin_apply_stripe_event", "dispute-" + uid, "dispute", "dp-" + uid, uid, None, 5)
        self.assertEqual(self.balance(), -4)
        self.rpc("admin_apply_stripe_event", "reinstate-" + uid, "dispute_reinstatement",
                 "dp-" + uid, uid, None, 5)
        self.assertEqual(self.balance(), 1)
        self.assertEqual(self.settle(version)["status"], "cancelled")
        self.assertEqual(self.rpc("data_figure_wallet", self.user)["held_bonus"], 0)

    def test_late_plan_does_not_resurrect_expired_version_or_extend_lease(self):
        version = self.reserve()
        self.ready(version)
        self.assertEqual(self.ready(version)["lease_expires_at"], version["lease_expires_at"])
        self.conn.execute("update member_data_figure_versions set lease_expires_at=now()-interval '1 second' where id=%s",
                          (version["id"],))
        self.assertEqual(self.ready(version)["status"], "expired")
        self.assertEqual(self.rpc("data_figure_wallet", self.user)["held_bonus"], 0)
        self.assertEqual(self.balance(), 3)

    def test_missing_actual_model_and_bad_outcome_are_rejected(self):
        version = self.reserve()
        for provider, model in (("mga", None), ("mga", "  "), ("mga", "x" * 129), ("unknown", "model")):
            with self.assertRaisesRegex(psycopg.Error, "invalid_data_figure_plan"):
                self.rpc("mark_data_figure_renderable", self.user, version["id"], "c" * 64, provider, model)
        with self.assertRaisesRegex(psycopg.Error, "invalid_data_figure_outcome"):
            self.settle(version, "expired")
        self.assertEqual(self.reserve()["status"], "reserved")

    def test_status_reads_owner_version_and_available_wallet(self):
        version = self.reserve()
        result = self.rpc("get_data_figure", self.user, version["id"])
        self.assertEqual(result["id"], version["id"])
        self.assertEqual(result["requested_model"], "deepseek-v4.1-flash")
        self.assertEqual(result["status"], "reserved")
        self.assertEqual((result["bonus_balance"], result["held_bonus"], result["available_bonus"]), (3, 1, 2))

    def test_status_expires_lease_without_a_charge(self):
        version = self.reserve()
        self.conn.execute("update member_data_figure_versions set lease_expires_at=now()-interval '1 second' where id=%s",
                          (version["id"],))
        result = self.rpc("get_data_figure", self.user, version["id"])
        self.assertEqual(result["status"], "expired")
        self.assertEqual(result["held_bonus"], 0)
        self.assertEqual(self.balance(), 3)
        self.assertEqual(self.rpc("get_data_figure", self.user, version["id"])["status"], "expired")

    def test_status_rejects_other_owner_and_unprivileged_calls(self):
        version = self.reserve()
        stranger = uuid4()
        self.conn.execute("insert into auth.users(id) values (%s)", (stranger,))
        with self.assertRaisesRegex(psycopg.Error, "data_figure_not_found"):
            self.rpc("get_data_figure", stranger, version["id"])
        with self.assertRaisesRegex(psycopg.Error, "data_figure_not_found"):
            self.rpc("get_data_figure", self.user, uuid4())
        for role in ("anon", "authenticated"):
            self.assertFalse(self.conn.execute("select has_function_privilege(%s,'public.get_data_figure(uuid,uuid)','execute')",
                                               (role,)).fetchone()[0])
        with psycopg.connect(self.uri, autocommit=True) as service:
            service.execute("set role service_role")
            self.assertEqual(self.rpc("get_data_figure", self.user, version["id"], conn=service)["id"], version["id"])

    def claim(self, version, conn=None):
        return self.rpc("claim_data_figure_plan", self.user, version["id"], "a" * 64, conn=conn)

    def test_plan_claim_is_once_only_and_never_returns_the_token_on_replay(self):
        version = self.reserve()
        first = self.claim(version)
        self.assertEqual(first["kind"], "claimed")
        self.assertIn("token", first)
        second = self.claim(version)
        self.assertEqual(second["kind"], "pending")
        self.assertNotIn("token", second)
        self.assertEqual(self.balance(), 3)

    def test_concurrent_plan_claims_have_one_winner(self):
        version = self.reserve()
        results = self.race(lambda c: self.claim(version, c), lambda c: self.claim(version, c))
        self.assertCountEqual([r["kind"] for r in results], ["claimed", "pending"])

    def test_plan_claim_checks_request_owner_and_terminal_state(self):
        version = self.reserve()
        with self.assertRaisesRegex(psycopg.Error, "data_figure_request_conflict"):
            self.rpc("claim_data_figure_plan", self.user, version["id"], "f" * 64)
        stranger = uuid4()
        self.conn.execute("insert into auth.users(id) values (%s)", (stranger,))
        with self.assertRaisesRegex(psycopg.Error, "data_figure_not_found"):
            self.rpc("claim_data_figure_plan", stranger, version["id"], "a" * 64)
        self.settle(version, "cancelled")
        self.assertEqual(self.claim(version), {"kind": "terminal", "status": "cancelled"})

    def finish_plan(self, version, token, mapping=None, conn=None):
        from psycopg.types.json import Jsonb
        return self.rpc("finish_data_figure_plan", self.user, version["id"], token,
                        Jsonb(mapping if mapping is not None else {"category": "col_1", "value": "col_2"}),
                        "c" * 64, "mga", "actual-upstream-model", conn=conn)

    def test_plan_finish_binds_mapping_and_model_atomically_then_replays_cached(self):
        version = self.reserve()
        token = self.claim(version)["token"]
        self.assertEqual(self.finish_plan(version, token)["kind"], "cached")
        cached = self.claim(version)
        self.assertEqual(cached["mapping"], {"category": "col_1", "value": "col_2"})
        self.assertEqual(cached["specHash"], "c" * 64)
        self.assertEqual(cached["model"], "actual-upstream-model")
        self.assertNotIn("token", cached)
        self.assertEqual(self.balance(), 3)
        self.assertEqual(self.finish_plan(version, token), cached)
        self.assertEqual(self.rpc("get_data_figure", self.user, version["id"])["status"], "awaiting_render")

    def test_plan_finish_requires_private_claim_token(self):
        version = self.reserve()
        self.claim(version)
        with self.assertRaisesRegex(psycopg.Error, "data_figure_claim_conflict"):
            self.finish_plan(version, uuid4())
        self.assertEqual(self.rpc("get_data_figure", self.user, version["id"])["status"], "reserved")

    def test_plan_finish_rejects_raw_content_extra_roles_nested_values_and_duplicate_columns(self):
        version = self.reserve()
        token = self.claim(version)["token"]
        for mapping in ({}, {"csv": "private source"}, {"category": {"text": "private"}},
                        {"category": "col_0"}, {"category": "col_101"}, {"category": "patient-name"},
                        {"category": "col_1", "value": "col_1"}):
            with self.subTest(mapping=mapping):
                with self.assertRaisesRegex(psycopg.Error, "invalid_data_figure_mapping"):
                    self.finish_plan(version, token, mapping)
        self.assertEqual(self.claim(version)["kind"], "pending")

    def test_cancel_or_expiry_wins_over_late_plan_without_charge(self):
        for outcome in ("cancelled", "expired"):
            version = self.reserve(key=outcome)
            token = self.claim(version)["token"]
            if outcome == "cancelled":
                self.settle(version, outcome)
            else:
                self.conn.execute("update member_data_figure_versions set lease_expires_at=now()-interval '1 second' where id=%s",
                                  (version["id"],))
            self.assertEqual(self.finish_plan(version, token), {"kind": "terminal", "status": outcome})
            self.assertEqual(self.claim(version), {"kind": "terminal", "status": outcome})
            self.assertEqual(self.balance(), 3)

    def test_finished_mapping_is_immutable_and_not_directly_readable(self):
        version = self.reserve()
        token = self.claim(version)["token"]
        self.finish_plan(version, token)
        with self.assertRaisesRegex(psycopg.Error, "data_figure_plan_conflict"):
            self.finish_plan(version, token, {"category": "col_3", "value": "col_2"})
        for role in ("anon", "authenticated", "service_role"):
            self.assertFalse(self.conn.execute("select has_table_privilege(%s,'public.member_data_figure_plans','select')",
                                               (role,)).fetchone()[0])
        for role in ("anon", "authenticated"):
            for fn in ("claim_data_figure_plan(uuid,uuid,text)", "finish_data_figure_plan(uuid,uuid,uuid,jsonb,text,text,text)"):
                self.assertFalse(self.conn.execute("select has_function_privilege(%s,%s,'execute')", (role, "public." + fn)).fetchone()[0])

    def test_concurrent_plan_completion_and_cancel_leave_no_renderable_cancelled_version(self):
        version = self.reserve()
        token = self.claim(version)["token"]
        results = self.race(lambda c: self.finish_plan(version, token, conn=c),
                            lambda c: self.settle(version, "cancelled", conn=c))
        self.assertTrue(all(isinstance(r, dict) for r in results))
        self.assertEqual(self.claim(version), {"kind": "terminal", "status": "cancelled"})
        self.assertEqual(self.balance(), 3)

    def test_parallel_plan_finish_replays_one_immutable_mapping(self):
        version = self.reserve()
        token = self.claim(version)["token"]
        a, b = self.race(lambda c: self.finish_plan(version, token, conn=c),
                         lambda c: self.finish_plan(version, token, conn=c))
        self.assertEqual(a, b)
        self.assertEqual(a["kind"], "cached")
        self.assertEqual(self.balance(), 3)

    def test_plan_service_role_can_use_private_rpcs_but_other_owner_cannot_finish(self):
        version = self.reserve()
        with psycopg.connect(self.uri, autocommit=True) as service:
            service.execute("set role service_role")
            token = self.claim(version, service)["token"]
            self.assertEqual(self.finish_plan(version, token, conn=service)["kind"], "cached")
        stranger = uuid4()
        self.conn.execute("insert into auth.users(id) values (%s)", (stranger,))
        from psycopg.types.json import Jsonb
        with self.assertRaisesRegex(psycopg.Error, "data_figure_not_found"):
            self.rpc("finish_data_figure_plan", stranger, version["id"], token,
                     Jsonb({"category": "col_1"}), "c" * 64, "mga", "actual")

    def test_repeatable_read_plan_racer_must_retry_not_claim_another_call(self):
        version = self.reserve()
        with psycopg.connect(self.uri, autocommit=True) as old:
            old.execute("begin isolation level repeatable read")
            old.execute("select bonus_balance from member_profiles where user_id=%s", (self.user,))
            self.claim(version)
            with self.assertRaises(psycopg.errors.SerializationFailure):
                self.claim(version, old)
            old.execute("rollback")
        self.assertEqual(self.claim(version)["kind"], "pending")


if __name__ == "__main__":
    unittest.main()
