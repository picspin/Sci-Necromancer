# Jev Adapter Safety Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Safely take over the existing uncommitted adapter, eliminate BYOK disclosure and malformed-answer acceptance before connecting the new member workflow.

**Architecture:** Retain the official TypeSafe transport as an unexposed building block. Disable the current public analysis endpoint until server-owned consent, wallet, durable quota and candidate-policy orchestration replaces it. Do not merely invert its existing BYOK conditional.

**Tech Stack:** TypeScript, Vitest, Vercel API, existing Vue app.

**Spec:** `docs/specs/2026-09-21-jev-member-workflows-design.md`

## Global Constraints

- BYOK must never cause a TypeSafe request.
- Official TypeSafe only; no live calls, credentials, deployment, push or production migrations.
- Invalid or incomplete answers are protocol errors, never zeros or valid low scores.
- Existing unrelated changes, including package-lock.json and Supabase setup files, remain untouched.
- This is a prerequisite safety slice, not completion of the full Jev product.

## Scope and following plans

After this safety slice, implement independently testable subsystems in order: (1) server consent plus wallet-backed eligibility and atomic 3/minute, 30/rolling-day reservations/cache; (2) member analysis wiring, server-owned conference candidates and uncertainty UI; (3) version-bound post-check, bounded repair and five-dimensional result UI; (4) blind review and separate illustration recommendation/retry flow; (5) data figure runtime and its template catalog. Keep all new production capabilities off until measured validation. Each needs its own integration plan against current code, not speculative file names here.

### Task 1: Close unsafe entry points and validate adapter boundaries

**Files:** Modify `lib/llm/index.ts`, `api/jev.ts`, `backend/_jev/typesafe.ts`, `backend/_jev/typesafe.test.ts`, `.env.example`; create `tests/api/jev.test.ts`, `lib/llm/__tests__/jevIsolation.test.ts`.

**Interfaces:** Retain `sanitizeJevAnalysisInput(value: unknown): JevAnalysisInput`, `buildJevAnalysisRequest(input: JevAnalysisInput)`, `parseJevAnalysisResponse(payload: unknown, input: JevAnalysisInput): JevAnalysisOutput`, and `requestTypesafeJev(input, fetchImpl?)`. The current `/api/jev` endpoint remains unavailable regardless of the old environment flag until a protected member service is implemented. Retain standard OPTIONS, method and origin handling.

- [ ] Add failing tests first: enabling the old flag must not cause `/api/jev` to authenticate/send source to TypeSafe; expect 503 with `typesafe_jev_member_workflow_unavailable`. Disabled flag retains 404. Remove `tryJevContentAnalysis` import/call from the shared BYOK analysis function, and add a regression test with the frontend flag true and a BYOK request that verifies the helper is not called and the normal provider remains used. Use existing LLM test mocks to avoid network.

```ts
expect(response.status).toHaveBeenCalledWith(503);
expect(response.json).toHaveBeenCalledWith({ error: 'typesafe_jev_member_workflow_unavailable' });
expect(requestTypesafeJev).not.toHaveBeenCalled();
```

- [ ] Add protocol tests using a valid complete fixture and mutate one property per case: missing expected answer; wrong answer type; missing/NaN/infinite/out-of-range/string noul; missing/empty model; extra answer ID. Expect `invalid_jev_analysis_response` (502). Preserve actual returned nonempty model identity rather than manufacturing the requested ID. Valid low probabilities must still parse and mark uncertainty, not throw. Validate every expected category/keyword answer, including those below selection thresholds.

```ts
const payload = validPayload();
delete payload.answers.has_methods;
expect(() => parseJevAnalysisResponse(payload, input)).toThrow('invalid_jev_analysis_response');
```

- [ ] Add strict input tests for partially invalid candidate arrays, duplicate category names, wrong category types, empty/oversized labels and nonstrings. Bound conference length to 64, category/keyword labels to 160 characters, each candidate array to 64, and complete serialized request to 120000 UTF-8 bytes. Reject rather than silently discard invalid entries. Source remains max 80000 characters; byte-budget rejection is explicit. These are internal defensive ceilings, not a substitute for future server-owned candidate lists. No silently accepted truncation.

- [ ] Run focused red tests: `npx vitest run backend/_jev/typesafe.test.ts tests/api/jev.test.ts lib/llm/__tests__/jevIsolation.test.ts` and record observed failures.

- [ ] Implement minimal validation: derive expected answer keys from `buildJevAnalysisRequest(input).questions`; compare exact own-key set; require each answer record `type === 'noul'` and finite number in [0,1]. Validate model before constructing output. Harden source/candidate bounds before building/sending requests. Do not treat malformed source or provider output as review success.

```ts
if (
  answer?.type !== 'noul' ||
  typeof answer.noul !== 'number' ||
  !Number.isFinite(answer.noul) ||
  answer.noul < 0 ||
  answer.noul > 1
) {
  throw new TypesafeJevError('invalid_jev_analysis_response', 502);
}
```

- [ ] Preserve timeout/non-OK/malformed JSON error behavior with mock fetch tests and verify fixed official destination. Document `.env.example` flags as reserved, insufficient to enable public access. Never test with live API keys.
- [ ] Run focused green tests, then `npm run lint`, `npm run build`, and full `npx vitest run`; distinguish baseline failures from introduced failures. Do not alter unrelated failing tests to greenwash.
- [ ] Self-review and report exact tests, changed files, limitations. Commit only this task's files if filesystem authorization permits; otherwise preserve working changes and report that fact. Controller generates a task-scoped diff for independent review.
