---
name: block-hardcoded-secrets-ts
enabled: true
event: file
action: block
conditions:
  - field: file_path
    operator: regex_match
    pattern: \.tsx?$
  - field: new_text
    operator: regex_match
    pattern: (API_KEY|SECRET_KEY|PASSWORD|ACCESS_TOKEN|PRIVATE_KEY)\s*[:=]\s*['"][^'"]{8,}['"]|sk-[a-zA-Z0-9]{20,}|ghp_[a-zA-Z0-9]{36}|ghu_[a-zA-Z0-9]{36}|xox[baprs]-[a-zA-Z0-9-]+
---

## Hardcoded Secret Detected - Operation Blocked

You're trying to add what appears to be a hardcoded secret or API key to a TypeScript file.

**Detected patterns:**

- `API_KEY = "..."` or similar credential assignments
- `sk-...` (OpenAI API keys)
- `ghp_...` / `ghu_...` (GitHub tokens)
- `xox...` (Slack tokens)

**This is blocked because:**

- Secrets in source code can be exposed in git history
- They may be accidentally pushed to public repositories
- Violates security best practices

**Better alternatives:**

1. Use environment variables: `process.env.API_KEY`
2. Use a `.env` file (add to `.gitignore`)
3. Use a secrets manager (AWS Secrets Manager, Vault, etc.)
4. Use configuration from `settings.local.json`

**To proceed:**

- Move the secret to an environment variable
- Reference it using `process.env.YOUR_SECRET_NAME`
