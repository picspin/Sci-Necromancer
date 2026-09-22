# Jev Member Policy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the durable authorization and quota boundary required before any member paper can reach TypeSafe.

**Architecture:** Supabase service-role-only RPCs own consent, wallet checks, quota reservations and user-scoped cache. A small TypeScript service normalizes RPC results; it is not wired into the public Jev endpoint until conference policy, frontend consent and workflow integration are complete.

**Tech Stack:** PostgreSQL/Supabase migrations, TypeScript, Vitest.

**Spec:** `docs/specs/2026-09-21-jev-member-workflows-design.md`

## Global Constraints

- No production migrations, network calls to TypeSafe, new credentials, deployment or push.
- Consent precedes any source send; no consent or balance <= 0 denies new free analysis, including cache access.
- 3 new attempts per rolling minute, 30 successful or active reservations per rolling 24 hours. Failure releases daily capacity, not minute attempt pressure.
- Cache is scoped by user, source hash, conference and policy/model/question versions; use a SHA-256 digest of canonical server-owned input. No plaintext source in usage tables or logs.
- Existing paid task completion does not recheck positive balance; this policy service is exclusively for new free analysis.
- Endpoint remains disabled. Integration and real PostgreSQL concurrency tests are release blockers, not satisfied by static SQL tests.

### Task 1: Durable consent and free-analysis policy service

**Files:** Create `supabase/migrations/202609220001_jev_member_policy.sql`, `backend/_jev/memberPolicy.ts`, `backend/_jev/memberPolicy.test.ts`, `tests/jev/memberPolicyMigration.test.ts`.

**Interfaces:** Export `JEV_CONSENT_VERSION = 'typesafe-member-2026-09-21-v1'`, `createJevMemberPolicy(client: MemberRpcClient)`. Returned methods: `getConsent(): Promise<{accepted:boolean;version:string}>`; `setConsent(accepted:boolean): Promise<void>`; `reserve(cacheKey:string): Promise<JevReservation>`; `settle(reservationId:string, success:boolean, result?:Record<string,unknown>): Promise<void>`. `JevReservation` discriminated union has kind `reserved` (reservationId), `cached` (result), `pending` (reservationId), or `limited` (retryAt); all include remaining:number. Faults use existing `MemberServiceError` with explicit codes. All user IDs come from scoped server RPC, never browser arguments.

- [ ] Write failing service tests with mocked RPC boundaries: expected RPC names/args, consent denied 403, insufficient balance 402, unavailable/bad results 503, successful reserved/cache/pending/limited outputs, failure settlement no result, success requires bounded result. Assert no provider call is part of this module. Validate all returned fields rather than cast untrusted RPC JSON. Validate 64 lowercase hex cache keys and UUID reservation IDs.

```ts
expect(await service.reserve('a'.repeat(64))).toEqual({
  kind: 'reserved',
  reservationId: uuid,
  remaining: 29,
});
await expect(service.reserve('raw manuscript')).rejects.toMatchObject({
  code: 'invalid_jev_cache_key',
});
```

- [ ] Implement SQL tables: `member_jev_consents` keyed user, with version/accepted/updated_at; `member_jev_analysis_attempts` uuid id/user/cache_key/status pending|completed|failed/created_at/lease_expires_at; `member_jev_analysis_cache` keyed user/cache_key with jsonb result/expiry. Cascade auth user deletes. Enable RLS, revoke direct anon/authenticated/PUBLIC table access, grant service_role only. No broad select policies exposing cached analysis. Index user/time and user/key/status. Cache result expires in 24h; lease 120 seconds.
- [ ] Implement `jev_get_consent(p_user_id)`, `jev_set_consent(p_user_id,p_version,p_accepted)`, `jev_reserve_analysis(p_user_id,p_version,p_cache_key)`, `jev_settle_analysis(p_user_id,p_reservation_id,p_success,p_result)` as service-role-only security-definer functions with fixed search_path and explicit PUBLIC/anon/authenticated execute revocations. All lock the member_profiles row before related writes; absent profile errors. Use DB clock after acquiring lock. Set consent requires exact current version; denial clears own cached results and fails own pending reservations. No financial ledger mutation.
- [ ] Reserve atomically: check current consent and wallet balance >0; mark expired leases failed; prune expired own cache; return live own cache before limits (no added attempt); return same-key active reservation as pending (no duplicate attempt); then count all attempts from last minute and completed/active pending from last24h; if limited return DB-derived retryAt and remaining without inserting; else insert pending lease, return ID/remaining. Count minute failures, exclude failed from day. RetryAt is the latest required expiration across binding windows; active leases release at lease expiry if sooner than day expiry. Reject oversized or non-digest cache key.
- [ ] Settlement atomically locks profile then owned reservation, requires active unexpired pending state; expired marks failed and refuses publishing cache. Successful settlement also requires current accepted consent; do not recheck balance. Duplicate same outcome returns successfully, opposite outcome conflicts. Success stores bounded json object (<=65536 UTF-8 bytes, no source text accepted by service contract) under original key for24h; failure must not persist a result. Only valid terminal outcomes; foreign IDs return not found. Add service-only `jev_prune_expired_analysis()` to remove expired cache and mark timed-out pending attempts failed; retain attempt metadata 48h for window accounting, purge older rows. Do not configure a production scheduler from code.
- [ ] Implement TypeScript methods using exact RPC names, scope client and strict response validation. Include error mapping: consent required403, insufficient_bonus402, not_found404, expired/conflict409, malformed args400, backend/protocol503. Unknown RPC error messages never leak. Normalized quota statuses are not exceptions.
- [ ] Add static migration contract tests for RLS, grants/revokes, profile locking, server clock, all named RPCs, no ledger updates, interval constants and cache expiry. Label them static and not proof of transaction semantics. Include documented manual PostgreSQL tests for 31 concurrent calls, 4 calls within minute, failure capacity, same-key parallel requests, stale settlement and consent revocation race.
- [ ] Run `npx vitest run backend/_jev/memberPolicy.test.ts tests/jev/memberPolicyMigration.test.ts` red then green, `npm run lint`, `npm run build`. Record local database availability; if no PostgreSQL runtime exists, report concurrency verification unavailable and retain release blocker. Do not fake an in-memory limiter as production implementation.
- [ ] Self-review and commit only owned files if allowed; write report with exact evidence and unresolved integration/release blockers.
