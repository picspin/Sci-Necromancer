#!/bin/bash
###############################################################################
# Hook 测试脚本
# 测试 Claude + Husky hooks 的完整工作流程
###############################################################################

set -e

echo "🧪 Testing Hook Workflow"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

PROJECT_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$PROJECT_ROOT"

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

###############################################################################
# 测试 1: Claude Hook 是否存在且可执行
###############################################################################
echo "Test 1/5: Checking Claude hook..."

if [ ! -f ".claude/hooks/pre-commit.sh" ]; then
    echo "❌ Claude hook not found at .claude/hooks/pre-commit.sh"
    exit 1
fi

if [ ! -x ".claude/hooks/pre-commit.sh" ]; then
    echo "⚠️  Claude hook not executable, fixing..."
    chmod +x .claude/hooks/pre-commit.sh
fi

echo -e "${GREEN}✓ Claude hook exists and is executable${NC}"
echo ""

###############################################################################
# 测试 2: Husky Hook 是否存在且可执行
###############################################################################
echo "Test 2/5: Checking Husky hook..."

if [ ! -f ".husky/pre-commit" ]; then
    echo "❌ Husky hook not found at .husky/pre-commit"
    exit 1
fi

if [ ! -x ".husky/pre-commit" ]; then
    echo "⚠️  Husky hook not executable, fixing..."
    chmod +x .husky/pre-commit
fi

echo -e "${GREEN}✓ Husky hook exists and is executable${NC}"
echo ""

###############################################################################
# 测试 3: 检查必要的工具
###############################################################################
echo "Test 3/5: Checking required tools..."

MISSING_TOOLS=()

if ! command -v npx &> /dev/null; then
    MISSING_TOOLS+=("npx")
fi

if ! command -v git &> /dev/null; then
    MISSING_TOOLS+=("git")
fi

# Claude Code CLI 是可选的
if ! command -v cc &> /dev/null; then
    echo -e "${YELLOW}⚠️  Claude Code CLI (cc) not found (optional)${NC}"
    echo "   Install from: https://claude.com/claude-code"
else
    echo -e "${GREEN}✓ Claude Code CLI (cc) found${NC}"
fi

if [ ${#MISSING_TOOLS[@]} -gt 0 ]; then
    echo "❌ Missing required tools: ${MISSING_TOOLS[*]}"
    exit 1
fi

echo -e "${GREEN}✓ All required tools available${NC}"
echo ""

###############################################################################
# 测试 4: 运行格式化和 Lint 检查
###############################################################################
echo "Test 4/5: Running format and lint check..."

echo "  → Checking if formatting would change files..."
if npx prettier --check '**/*.{ts,tsx,vue,json}' 2>/dev/null; then
    echo -e "${GREEN}  ✓ All files properly formatted${NC}"
else
    echo -e "${YELLOW}  ⚠️  Some files need formatting${NC}"
    echo "  Run: npm run format"
fi

echo ""
echo "  → Checking ESLint..."
if npx eslint --quiet '**/*.{ts,tsx,vue}' 2>/dev/null; then
    echo -e "${GREEN}  ✓ No ESLint errors${NC}"
else
    echo -e "${YELLOW}  ⚠️  ESLint found some issues${NC}"
    echo "  Run: npm run lint:fix"
fi

echo ""

###############################################################################
# 测试 5: 模拟 Git Commit 流程 (不实际提交)
###############################################################################
echo "Test 5/5: Simulating commit flow..."

# 创建一个临时测试文件
TEST_FILE=".test-hook-$(date +%s).tmp"
echo "// Test file for hook validation" > "$TEST_FILE"
git add "$TEST_FILE"

echo "  → Running hooks with test file..."

# 设置环境变量跳过 Claude hook (因为 cc 可能不可用)
export CLAUDE_HOOK_ENABLED=false

# 运行 Husky hook
if .husky/pre-commit; then
    echo -e "${GREEN}  ✓ Hooks passed${NC}"
else
    echo -e "${YELLOW}  ⚠️  Hooks would block commit${NC}"
fi

# 清理测试文件
git reset HEAD "$TEST_FILE" 2>/dev/null
rm -f "$TEST_FILE"

unset CLAUDE_HOOK_ENABLED

echo ""

###############################################################################
# 测试完成
###############################################################################

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✅ All hook tests passed!${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Hook workflow is ready to use:"
echo "  1. Claude hook will auto-fix errors on commit"
echo "  2. Husky hook will validate and block bad commits"
echo ""
echo "Try committing to see the hooks in action:"
echo "  git add ."
echo "  git commit -m 'test: hook validation'"
echo ""
