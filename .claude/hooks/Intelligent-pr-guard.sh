#!/bin/bash
# Intelligent PR Guard - Warns but does not block push
# Quality checks are run via subagent BEFORE this hook triggers

set -e

# ============ Configuration ============
YOUR_EMAIL="zxl1412@gmail.com"
YOUR_USERNAME="Xiaolei,Zhu"
SEND_KEY=""  # Server酱 key (optional)
# ======================================

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Logging functions
log_info() { echo -e "${BLUE}[INFO]${NC} $1" >&2; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1" >&2; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1" >&2; }
log_error() { echo -e "${RED}[ERROR]${NC} $1" >&2; }

# Read input from Claude
input=$(cat)
command=$(echo "$input" | jq -r '.tool_input.command // empty' 2>/dev/null)

# Only process git push commands
if [[ ! "$command" =~ git[[:space:]]+push ]]; then
  echo '{"hookSpecificOutput": {"permissionDecision": "allow"}}'
  exit 0
fi

log_info "Detected git push operation, running PR analysis..."

# ============ Agent Commit Analysis ============
analyze_agent_commits() {
  log_info "Analyzing multi-agent commit history..."

  # Fetch remote info
  git fetch origin main &>/dev/null || true

  current_branch=$(git branch --show-current)
  log_info "Current branch: $current_branch"

  # Check if we can compare with origin/main
  if git rev-parse origin/main &>/dev/null; then
    main_commit=$(git rev-parse origin/main)
    log_info "Remote main branch: ${main_commit:0:8}"

    echo "" >&2
    log_info "Recent commit analysis (last 10):"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >&2

    git log -10 --pretty=format:"%h - %an - %s" | while IFS= read -r line; do
      # Identify agent by author
      if echo "$line" | grep -qiE "claude|anthropic"; then
        echo -e "${BLUE}[Claude]${NC} $line" >&2
      elif echo "$line" | grep -qiE "cursor"; then
        echo -e "${GREEN}[Cursor]${NC} $line" >&2
      elif echo "$line" | grep -qiE "$YOUR_EMAIL|$YOUR_USERNAME"; then
        echo -e "${NC}[Human]${NC} $line" >&2
      else
        echo -e "${YELLOW}[Unknown]${NC} $line" >&2
      fi
    done

    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >&2
  else
    log_warning "Cannot compare with origin/main (remote may not exist)"
  fi
}

# ============ Generate Warning Report ============
generate_warning_report() {
  echo "" >&2
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >&2
  log_warning "PR Push Warning Report"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >&2

  # Show changes summary
  if git rev-parse origin/main &>/dev/null; then
    local changes
    changes=$(git diff origin/main...HEAD --stat 2>/dev/null | tail -1)
    if [ -n "$changes" ]; then
      log_info "Changes summary: $changes"
    fi

    # Show modified files
    local file_count
    file_count=$(git diff origin/main...HEAD --name-only 2>/dev/null | wc -l | tr -d ' ')
    log_info "Files modified: $file_count"
  fi

  echo "" >&2
  log_warning "Reminder: Ensure quality checks passed before pushing!"
  log_info "- Prettier formatting"
  log_info "- ESLint validation"
  log_info "- Build verification"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >&2
  echo "" >&2
}

# ============ Main Execution ============
main() {
  # Analyze commits
  analyze_agent_commits

  # Generate warning report
  generate_warning_report

  # Send notification if configured
  if [ -n "$SEND_KEY" ]; then
    curl -s -X POST "https://sctapi.ftqq.com/${SEND_KEY}.send" \
      -d "title=Claude Code: Git Push" \
      -d "desp=Git push operation detected" >/dev/null &
  fi

  # ALLOW the push with warnings (not block)
  log_success "Push operation ALLOWED - proceeding..."

  cat << EOF
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "allow",
    "permissionDecisionReason": "PR analysis complete. Push allowed with warnings."
  }
}
EOF
}

# Execute
main
