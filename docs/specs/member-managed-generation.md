# Membership, routing, and managed-generation specification (v2)

## Objective

Provide a low-friction membership layer without weakening BYOK, privacy, or wallet integrity. A user can authenticate with GitHub or verified email/password, receive and purchase bonus, use capability-specific managed text/image/review services, and explicitly save a bounded set of generated abstracts. BYOK is always preferred for the capability it actually configures.

## Runtime and commands

- Vue/Vite static frontend: Cloudflare Pages.
- Privileged Node functions: Vercel `iad1`.
- Identity, wallet, workflow state, and cloud abstracts: Supabase Auth/Postgres.
- Build: `npm run build`
- Type check: `npm run lint`
- Tests: `npm test -- --run`
- Local development: `npm run dev`

## Project structure

- `src/components/membership/`, `src/composables/useMembership.ts`: account and wallet UI/state.
- `src/components/managers/ModelManager.vue`: Member Benefits, Personal API, and Skills & MCP.
- `lib/llm/`, `src/composables/useImageGeneration.ts`: capability routing and workflow state.
- `api/member/`, `api/generate.ts`, `api/blind-review.ts`: authenticated boundaries.
- `backend/_member/`, `backend/_generation/`, `backend/_review/`: shared server logic kept outside `api/` so Vercel only discovers public route handlers as Functions.
- `supabase/migrations/`: authoritative schema/RPC changes.
- Tests remain colocated with the behavior they protect.

## Account model

- GitHub OAuth and email/password registration/login are supported. Email registration requires verification.
- Forgot-password, reset-password, email change, password change, nickname, and sign-out are available where applicable. GitHub-only accounts do not show password controls.
- GitHub avatars are read from provider metadata. Email users get a generated initial avatar. User-uploaded avatars and a Storage bucket are intentionally excluded.
- The first verified login awards five signup bonus automatically and idempotently. There is no Claim button.
- WeChat is omitted until approved WeChat Open Platform credentials exist.

## Wallet, check-in, and storage

- All balance mutations are server-side, transactional, idempotent, and recorded in `bonus_ledger`.
- Beijing calendar-day check-in awards +1. The seventh consecutive day awards an extra +1 and resets the displayed cycle to 0/7. A missed day restarts at 1/7. Signup day can also be checked in.
- Stripe remains 1 CNY = 1 bonus; only verified webhooks mutate balances.
- Cloud abstracts are limited to 10,000 UTF-8 bytes each. Base quota is 30. Permanent upgrades are 100 for 2 bonus total and 500 for 10 bonus total. Upgrade and deduction are one transaction. No automatic deletion or downgrade.
- Updating an existing cloud abstract does not consume another slot. Original manuscripts, uploaded images, credentials, and internal prompts are never stored.

## Capability routing

- Text and image capabilities are resolved independently.
- A complete BYOK configuration for the requested capability always wins and consumes no bonus.
- A configured BYOK failure never silently falls back to a paid member request. The user must explicitly confirm managed fallback.
- Personal API protocols are OpenAI Chat Completions, Anthropic Messages, and advanced Google Gemini Native. Model loading is optional; manual model entry always remains available.
- Personal credentials remain browser-local and are never sent to the membership backend.
- Managed credentials are provider-authorized server credentials only. Personal Antigravity consumer OAuth files/tokens and shared consumer account pools are prohibited.

## Managed workflow billing

- A two-credit abstract workflow permits, server-side and across refreshes: analysis once, initial generation once, one additional generation, and deep update once (maximum four provider calls).
- Re-analysis and one-click creative generation each start a new two-credit workflow.
- A third generation or second deep update opens a confirmation dialog with:
  1. re-analyze and generate (recommended, two credits), or
  2. continue current result as a standalone task (two credits).
- Cancel performs no call and no charge. Failed calls producing no deliverable do not consume an allowance and refund any reservation.
- Deep update is a distinct high-reasoning operation. Gemini uses high thinking, OpenAI-compatible providers use high reasoning when supported, and Anthropic uses extended thinking when supported. Unsupported BYOK never silently degrades to ordinary generation.
- BYOK workflows may track UX allowances locally, but no wallet security relies on browser state.

## Managed review and image generation

- Blind Review obeys BYOK-first routing. Without text BYOK, every click is one managed bonus task. Selected PubMed/CiteCheck/DOI checks are included in that task, not separately charged. No deliverable means refund; retries are new tasks.
- Member Benefits exposes separate Nano Banana and GPT Image checkboxes. They enable availability only; selecting a model and invoking generation performs the charge.
- A corresponding image BYOK configuration wins. Otherwise each managed image request costs two credits. There is no silent cross-provider fallback.
- Managed model IDs are environment-overridable. Defaults use currently public provider models; UI branding does not promise an unavailable future model.

## UI requirements

- Model Configuration tabs are ordered: Member Benefits, Personal API, Skills & MCP.
- Member Benefits contains account identity, bonus, check-in cycle/action, cloud usage/upgrades, managed capability checkboxes, payment, and concise user-facing rules. Infrastructure-region prose is omitted.
- Inputs use readable foreground/placeholder contrast. Loading models produces a searchable selector and preserves manual input on failure.
- Image publication style keeps Lancet, Nature, NEJM, and Science as primary buttons. JAMA & BMJ, Radiology, IEEE/ICML/NeurIPS, and Cell are a compact select like the schematic-layout selector. MRI Figure Template remains removed.
- All new copy has complete Chinese and English locale parity and usable keyboard/focus behavior.

## Boundaries

- Always: authorize server-side, validate UTF-8 byte size, use idempotency keys, settle/refund atomically, keep the generative-AI accuracy warning, and test production ESM imports.
- Ask first: new dependencies, another external identity provider, a new storage tier, pricing changes, or a provider credential mechanism.
- Never: trust client balances/counters, expose service-role/provider secrets, auto-charge after BYOK failure, upload avatars, store source manuscripts, or deploy personal consumer OAuth tokens.

## Testing strategy and success criteria

- SQL/RPC tests or executable migration assertions cover signup, check-in cycles, quota upgrades, workflow allowances, concurrency, idempotency, and refunds.
- Unit tests cover capability routing, account methods, model loading, byte/count limits, image styles, and locale parity.
- Component tests cover tab order, member controls, disabled/confirmation states, account forms, and dropdown behavior.
- Production build/type check/full tests pass. Post-deploy smoke proves health 200, unauthenticated member status 401, webhook GET 405, valid signed webhook 200, authenticated status/check-in/checkout, and one managed task with correct balance change.
