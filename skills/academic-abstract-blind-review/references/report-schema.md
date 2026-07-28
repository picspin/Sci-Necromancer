# Structured report contract

Return one JSON object matching the website contract:

```json
{
  "version": "blind-review-v1",
  "conference": "RSNA",
  "reviewedAt": "2026-07-28T00:00:00.000Z",
  "overallStatus": "action-required",
  "modelAssessment": {
    "recommendation": "major-revision",
    "summary": "Concise evidence-based assessment",
    "findings": [
      {
        "id": "data-1",
        "dimension": "data-integrity",
        "severity": "critical",
        "claim": "The generated sample size differs from the source.",
        "evidence": "Generated n=128; source n=82.",
        "recommendation": "Restore the source value and recheck all denominators.",
        "verificationStatus": "contradictory"
      }
    ]
  },
  "externalVerification": [
    {
      "reviewer": "pubmed",
      "status": "unavailable",
      "checkedAt": "2026-07-28T00:00:00.000Z",
      "summary": "Reviewer was not provisioned.",
      "records": []
    }
  ],
  "disclaimer": "blind_review.disclaimer"
}
```

Allowed values:

- `conference`: `ISMRM`, `RSNA`, `ER`, `ESC`
- `overallStatus`: `verified-with-limitations`, `action-required`
- `recommendation`: `pass-with-caveats`, `minor-revision`, `major-revision`, `reject`
- `dimension`: `ethics-and-consent`, `de-identification`, `data-integrity`, `methodology`, `citation-integrity`, `conference-compliance`, `reporting-guideline`
- `severity`: `critical`, `high`, `medium`, `low`, `info`
- finding `verificationStatus`: `verified`, `supported`, `unsupported`, `contradictory`, `not-verifiable`
- external `status`: `verified`, `issues-found`, `unavailable`, `not-run`
- `reviewer`: `pubmed`, `citecheck`, `doi-mcp`

Use `verified-with-limitations` only when every selected external reviewer completed without reported issues and the model found no blocking issue. The disclaimer remains mandatory.
