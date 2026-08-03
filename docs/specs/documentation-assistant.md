# 炼气师 / Sci Guide documentation assistant

## Outcome

Replace the static floating help modal with a public, documentation-first conversational assistant. It resolves common questions without AI, uses MGA `gpt-oss-120b` only for grounded follow-up answers, and can navigate to allowlisted UI destinations without changing user state.

## Product boundaries

- Public access: guests receive 3 assisted answers per day; authenticated users receive 20.
- Help Shortcuts, article browsing, and Guided Navigation are unlimited and never consume member credits.
- Assisted Answers do not use BYOK, member generation workflows, Skills, MCP, blind review, abstracts, uploads, or cloud storage.
- Conversations are session-only, carry at most six recent question-answer exchanges (12 role messages), and are never persisted.
- The assistant receives only locale, active module, authentication state, capability booleans, provider kind, coarse base-URL kind, request stage, and public error codes.
- API keys, access tokens, account identifiers, emails, payment data, abstracts, uploads, generated output, and raw settings are prohibited.

## Knowledge contract

`docs/help/en/` and `docs/help/zh/` are the sole help source. Every paired article has a stable ID, topic, keywords, allowed shortcut IDs, applicable states, verification date, and UI destination. The first release covers modules, personal APIs, membership, cloud abstracts, blind review, Skills & MCP, troubleshooting, and AI safety/privacy.

Static retrieval returns at most four relevant articles. An Assisted Answer must cite at least one retrieved article and may only return registered article IDs and shortcut IDs. Unknown questions are rejected with a GitHub Issues escalation path. High-risk facts such as quotas and costs come from shared constants rather than duplicated prose.

## API contract

`POST /api/help` is rewritten to the existing `api/generate.ts` function and dispatched to an isolated documentation-assistant handler. The request accepts plain text up to 1,000 characters, locale, up to six recent question-answer exchanges, minimal page context, an idempotency key, and optional Turnstile proof. HTML, hidden control text, credentials, patient identifiers, prompt injection, URLs to fetch, and rich media are rejected or redacted. Reusing a reserved or completed idempotency key is rejected without another MGA dispatch.

The response contains a mode (`shortcut`, `assisted`, or `fallback`), localized text, citations, allowlisted shortcuts, remaining daily assisted-answer quota, and a request ID. MGA success or user cancellation consumes one daily request; provider timeout, 5xx, or invalid output does not. The target is an 8-second first-response timeout, a 20-second total timeout, no model fallback, at most 500 output tokens, and at most four articles / 6,000 characters of injected context.

## Interface contract

The right-bottom launcher opens a 420×640 desktop conversation panel or a mobile safe-area bottom sheet. It initially shows six context-aware questions and all help topics. Static and AI answers share one conversation. AI use requires a one-time per-session disclosure. Answers expose sources and allowlisted navigation; they cannot mutate settings, submit forms, pay, check in, delete, or generate content.

The interface supports Escape, focus restoration, focus containment, 44px touch targets, WCAG AA contrast, reduced motion, polite live announcements after a complete message, cancellation, offline static help, and GitHub Issues escalation without copying conversation or account data.

## Confirmed test seams

1. Help Catalog: language + question + page state → articles, static answers, and Guided Navigation.
2. `POST /api/help`: validation, redaction, quotas, MGA success/failure, and grounded response schema.
3. Help Assistant UI: shortcuts, disclosure, send/cancel, citations, and Guided Navigation.
4. App integration: launcher replacement, responsive opening/closing, and focus restoration.
5. Documentation contract: bilingual parity, IDs, links, shortcuts, shared facts, and i18n.
