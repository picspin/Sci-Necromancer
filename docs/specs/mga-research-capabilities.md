# MGA research capabilities

## Scope

- Authenticated members can list a server-owned capability catalog.
- The managed catalog contains three read-only MGA research tools: PubMed, Semantic Scholar, and Hubble Literature Abstracts.
- One managed research-verification agent may use only the member-enabled tools from that catalog.
- A research-verification run is one `blind_review` wallet task: one bonus is reserved and charged on success, and refunded on failure.
- The browser receives stable capability IDs and display metadata only. MGA URLs, credentials, raw tool configuration, and arbitrary tool keys are never accepted or returned.
- Existing blind review remains available. Enabling the managed research agent routes the same blind-review action through the managed agent, so no additional primary action button is introduced.

## Public API

### `GET /api/member/capabilities`

Requires a valid member bearer token and returns the sanitized catalog.

### `POST /api/member/capabilities`

Requires a valid member bearer token and `Idempotency-Key`. The body contains:

```json
{
  "capabilityId": "mga-research-verification-agent",
  "enabledCapabilityIds": ["mga-pubmed", "mga-semantic-scholar"],
  "prompt": "Research-verification prompt"
}
```

At least one approved read-only research tool must be selected. Unknown IDs, arbitrary tool keys, oversized prompts, and unsupported agents are rejected.
