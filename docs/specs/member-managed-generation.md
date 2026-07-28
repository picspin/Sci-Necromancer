# Member-managed generation specification

- Cloudflare serves the static Vue application. Privileged APIs run from Vercel Functions in `iad1`; this is an availability choice, not a mechanism to bypass provider geography or terms.
- Supabase Auth/Postgres is authoritative for identity, bonus balance, check-in state, managed tasks, and explicit cloud saves. GitHub OAuth is available; WeChat remains disabled until approved credentials exist.
- A verified account receives five signup bonus units once. A Beijing-calendar-day check-in awards one. Purchased units do not expire.
- One standard analysis-to-generation workflow costs one unit. The backend returns the task ID and advances monotonic analysis/synopsis/type/generation stages; calls are serialized and the workflow expires after 30 minutes. Regeneration, deep update, and each single-image request cost one unit each.
- Reservation and settlement are atomic. Provider calls time out before the function limit; failures refund immediately, while a later status/request recovers a rare stale in-flight reservation. Completed, expired, conflicting, busy, or refunded tasks cannot create an unlimited free-call path.
- Managed text uses `gemini-3.6-flash`; managed images use `gemini-3-pro-image` (Nano Banana Pro UI label) or `gpt-image-2`. There is no silent provider fallback.
- BYOK remains available without membership and never consumes member bonus.
- Stripe accepts integer CNY amounts of at least ¥10 at 1 CNY = 1 bonus. Only verified webhooks credit or reverse balances.
- Cloud save occurs only when the user explicitly presses Save and enables it. Original source manuscripts, uploaded images, and API keys are excluded from the cloud payload.
- The site-wide generative-AI warning remains mandatory: generated or edited content may be inaccurate and does not guarantee compliance, acceptance, or publication.
