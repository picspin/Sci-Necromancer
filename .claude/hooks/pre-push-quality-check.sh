#!/bin/bash
# Pre-push Quality Checks
# Run this script before git push to ensure code quality

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[✓]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[✗]${NC} $1"; }

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔍 Pre-Push Quality Checks"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

quality_passed=true

# Step 1: Prettier
log_info "Step 1/3: Running Prettier..."
if npx prettier --write "src/**/*.{ts,tsx,vue,js,jsx}" "lib/**/*.ts" "server/src/**/*.ts" 2>/dev/null; then
  log_success "Prettier formatting complete"
  git add -A 2>/dev/null || true
else
  log_warning "Prettier skipped (no matching files or not installed)"
fi

# Step 2: ESLint
log_info "Step 2/3: Running ESLint..."
if npx eslint --ext .js,.jsx,.ts,.tsx,.vue src/ lib/ server/src/ --fix --max-warnings 50 2>/dev/null; then
  log_success "ESLint check passed"
  git add -A 2>/dev/null || true
else
  log_error "ESLint check failed"
  quality_passed=false
fi

# Step 3: Build
log_info "Step 3/3: Running build..."
if npm run build 2>/dev/null; then
  log_success "Build successful"
  # Clean up build artifacts
  rm -rf dist .next build 2>/dev/null || true
else
  log_error "Build failed"
  quality_passed=false
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ "$quality_passed" = true ]; then
  log_success "All quality checks passed! Safe to push."
  exit 0
else
  log_error "Quality checks failed. Please fix issues before pushing."
  exit 1
fi
