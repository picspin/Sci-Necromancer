---
name: block-pre-push-check
enabled: true
event: bash
pattern: (git\s+push|gh\s+pr\s+create)
action: block
---

🛡️ **Pre-push Quality Gate - AUTOMATED**

The `intelligent-pr-guard.sh` hook will automatically run these checks:

**Step 1: Prettier Formatting** (auto-fix)

- Formats `src/**/*.{ts,tsx,vue,js,jsx}`
- Formats `server/src/**/*.ts`
- Auto-stages formatted files

**Step 2: ESLint Check** (auto-fix)

- Lints `src/` and `server/src/`
- Auto-fixes where possible
- Auto-stages fixed files

**Step 3: TypeScript Type Check**

- Runs `tsc --noEmit`

**Step 4: Build Verification**

- Runs `npm run build`
- Ensures Vercel deployment compatibility

**Step 5: Multi-Agent Commit Analysis**

- Identifies commits by different agents (Claude, Cursor, etc.)
- Generates comparison report

If any check fails, the push will be blocked until issues are resolved.

**Manual pre-check command:**

```bash
npx prettier --write "src/**/*.{ts,tsx,vue,js,jsx}" "server/src/**/*.ts" && npm run lint -- --fix && npm run build
```
