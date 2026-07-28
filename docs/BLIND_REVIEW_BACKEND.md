# Blind-review backend deployment

The browser exposes enable/disable checkboxes only. It must not accept MCP URLs, executable commands, package names, or gateway credentials from users.

## Built-in reviewer

PubMed uses NCBI E-utilities from the server route. A successful search means only that related literature was found; it does not verify the submitted cohort, data, analysis, or conclusions.

## Administrator-provisioned MCP facades

Configure these optional server-side environment variables in the deployment platform:

- `CITECHECK_MCP_URL`: HTTPS JSON-RPC facade exposing `review_abstract_citations`.
- `DOI_MCP_URL`: HTTPS JSON-RPC facade exposing `verify_citations`.
- `MCP_GATEWAY_TOKEN`: optional shared bearer token for those facades.
- `BLIND_REVIEW_EDGE_TOKEN`: required secret injected as `x-blind-review-edge-token` by a trusted reverse proxy/WAF before CiteCheck or DOI MCP can be called. Never expose it to browser JavaScript.

Both tools receive `{ citations, readOnly: true }` and must return `structuredContent` (or JSON text) with:

```json
{
  "status": "verified | issues-found | unavailable",
  "summary": "Human-readable result and limitations",
  "records": [
    {
      "query": "citation candidate",
      "status": "verified | supported | unsupported | contradictory | not-verifiable",
      "title": "optional",
      "identifier": "optional",
      "url": "optional HTTPS evidence URL",
      "details": "optional"
    }
  ]
}
```

Wrap the upstream CiteCheck or DOI MCP process behind a fixed read-only adapter. Do not expose a generic MCP tool name, shell command, filesystem path, or package installer to the web request. If a facade is absent or fails, the API returns `unavailable`; it must never report a successful verification.

## Safety properties

- `api/blind-review.ts` accepts only the generated text, title, keywords, conference, and three boolean selections.
- Production requests require a same-origin browser request. Privileged MCP reviewers additionally require the trusted edge header; configure shared production rate limiting at the reverse proxy/WAF because process-local serverless counters are only a secondary guard.
- Reviewer names and MCP tool names are server-side allowlists.
- External responses are advisory evidence, not proof of data authenticity or ethics compliance.
- Keep the generative-AI disclaimer visible with every report.
