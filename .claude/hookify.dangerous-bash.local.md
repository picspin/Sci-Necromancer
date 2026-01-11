---
name: warn-dangerous-bash
enabled: true
event: bash
pattern: rm\s+-rf|chmod\s+777|git\s+push\s+.*--force|git\s+reset\s+--hard|dd\s+if=|mkfs\.|>\s*/dev/sd
action: warn
---

## Dangerous Bash Command Detected

You're about to run a potentially dangerous command. Please verify:

**Matched patterns:**

- `rm -rf` - Recursive force delete (can wipe directories without confirmation)
- `chmod 777` - World-writable permissions (security risk)
- `git push --force` - Force push can overwrite remote history
- `git reset --hard` - Discards uncommitted changes permanently
- `dd if=` - Direct disk write (can corrupt data)
- `mkfs` - Format filesystem (destroys data)

**Before proceeding:**

- [ ] Double-check the target path/branch
- [ ] Confirm this is intentional
- [ ] Consider safer alternatives
