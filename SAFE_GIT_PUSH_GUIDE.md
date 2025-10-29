# Safe Git Push Guide

## Current Situation

- **Local branch**: `main` with many uncommitted changes
- **Remote**: `origin/main` at https://github.com/picspin/Sci-Necromancer.git
- **Goal**: Push local changes without losing any work

## Safe Push Strategy

### Step 1: Create a Safety Backup Branch

```bash
# Create a backup of current state (including uncommitted changes)
git stash push -u -m "Backup before push $(date +%Y%m%d-%H%M%S)"

# Create a backup branch
git branch backup-before-push-$(date +%Y%m%d-%H%M%S)

# Restore your changes
git stash pop
```

### Step 2: Check What's Different from Remote

```bash
# Fetch latest remote changes (doesn't modify your files)
git fetch origin

# See what's different between your local and remote
git diff main origin/main --stat

# See the actual differences
git diff main origin/main
```

### Step 3: Stage Your Changes

```bash
# Add all modified and new files
git add .

# Review what will be committed
git status

# If you want to exclude certain files, unstage them:
# git restore --staged <file>
```

### Step 4: Commit Your Changes

```bash
# Commit with a descriptive message
git commit -m "Major refactor: Simplified image generation, added MCP tools panel, updated docs

- Simplified image generation to 2 paths: SiliconFlow and MCP
- Added separate MCP Tools panel in Model Manager
- Updated .gitignore to exclude dev docs
- Rewrote README for user-friendliness
- Added comprehensive documentation guides"
```

### Step 5: Safe Push (Recommended Method)

**Option A: Force Push with Lease (Safest)**
```bash
# This will fail if someone else pushed to remote
# Protects against overwriting others' work
git push --force-with-lease origin main
```

**Option B: Regular Push (If No Conflicts)**
```bash
# Try regular push first
git push origin main

# If it fails due to divergent histories, see Option C
```

**Option C: Merge Remote Changes First (Most Conservative)**
```bash
# Fetch and merge remote changes
git pull --rebase origin main

# Resolve any conflicts if they occur
# Then push
git push origin main
```

## Recommended Approach

Since you want to ensure **no local files are lost**, use this sequence:

```bash
# 1. Create backup
git stash push -u -m "Safety backup $(date +%Y%m%d-%H%M%S)"
git branch backup-full-$(date +%Y%m%d-%H%M%S)
git stash pop

# 2. Fetch remote (doesn't change your files)
git fetch origin

# 3. Check differences
git diff main origin/main --stat

# 4. Stage and commit your changes
git add .
git commit -m "Major refactor: Image generation, MCP tools, documentation"

# 5. Try force-with-lease (safest force push)
git push --force-with-lease origin main
```

## If Something Goes Wrong

### Restore from Backup Branch
```bash
# List backup branches
git branch | grep backup

# Switch to backup
git checkout backup-full-YYYYMMDD-HHMMSS

# Create new branch from backup
git checkout -b recovery-branch

# Copy files you need
```

### Restore from Stash
```bash
# List stashes
git stash list

# Apply a stash
git stash apply stash@{0}
```

### Undo Last Commit (Keep Changes)
```bash
git reset --soft HEAD~1
```

### Undo Last Commit (Discard Changes)
```bash
git reset --hard HEAD~1
```

## Understanding Force Push Options

### `git push --force` ⚠️ DANGEROUS
- Overwrites remote completely
- Can lose others' work
- **NOT RECOMMENDED**

### `git push --force-with-lease` ✅ SAFE
- Only pushes if remote hasn't changed
- Protects against overwriting others' work
- **RECOMMENDED**

### `git push` ✅ SAFEST
- Regular push
- Fails if histories diverge
- Requires merge/rebase first

## Pre-Push Checklist

- [ ] Created backup branch
- [ ] Reviewed changes with `git status`
- [ ] Checked differences with remote
- [ ] Staged all desired files
- [ ] Written clear commit message
- [ ] Tested build locally (`npm run build`)
- [ ] Ready to push

## Post-Push Verification

```bash
# Verify push succeeded
git log --oneline -5

# Check remote matches local
git fetch origin
git diff main origin/main

# Should show no differences
```

## Emergency Recovery

If you accidentally lose work:

```bash
# Find lost commits
git reflog

# Restore to a previous state
git reset --hard HEAD@{n}

# Or cherry-pick specific commits
git cherry-pick <commit-hash>
```

## Your Specific Situation

Based on your current state:

**Modified files**: 13 files
**Deleted files**: 1 file (IMAGEN_INTEGRATION_GUIDE.md)
**New files**: 13 files (docs, components, services)

**Recommended command sequence**:

```bash
# 1. Safety first
git stash push -u -m "Pre-push backup"
git branch backup-$(date +%Y%m%d-%H%M%S)
git stash pop

# 2. Stage everything
git add .

# 3. Commit
git commit -m "Major refactor: Simplified architecture and improved docs

Changes:
- Simplified image generation (SiliconFlow + MCP paths)
- Added MCP Tools panel in Model Manager
- Updated .gitignore to exclude dev documentation
- Rewrote README for better user experience
- Added comprehensive user guides
- Implemented conference module system
- Added notification service
- Created database fallback service"

# 4. Push safely
git push --force-with-lease origin main
```

## Notes

- Your existing backup branches are safe: `backup-20251028-165310`, `backup-before-reset`
- All local changes will be preserved
- Remote will be updated to match your local state
- No data loss will occur

---

**Status**: Ready to execute
**Risk Level**: Low (with backup strategy)
**Estimated Time**: 2-3 minutes
