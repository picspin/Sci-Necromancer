#!/bin/bash
# 修改你的邮箱/用户名
YOUR_EMAIL= "zxl1412@gmail.com"
YOUR_USERNAME= "Xiaolei,Zhu"
set -e

# ============ 配置区域 ============
# Server酱通知（可选）
SEND_KEY="YOUR_SERVERCHAN_KEY"  # 留空则禁用通知
# ==================================

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 日志函数
log_info() { echo -e "${BLUE}[INFO]${NC} $1" >&2; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1" >&2; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1" >&2; }
log_error() { echo -e "${RED}[ERROR]${NC} $1" >&2; }

# 检查是否为git push命令
input=$(cat)
command=$(echo "$input" | jq -r '.tool_input.command // empty' 2>/dev/null)

if [[ ! "$command" =~ git[[:space:]]+push ]]; then
  echo '{"hookSpecificOutput": {"permissionDecision": "allow"}}'
  exit 0
fi

log_info "检测到git push操作，启动多Agent PR智能分析..."

# ============ 第一层：代码质量门禁 ============
run_quality_gate() {
  log_info "执行代码质量检查..."

  local quality_passed=true
  local failed_gates=()

  # 0. Prettier格式化
  log_info "运行Prettier格式化..."
  if npx prettier --write "src/**/*.{ts,tsx,vue,js,jsx}" "server/src/**/*.ts" 2>/dev/null; then
    log_success "Prettier格式化完成"
    # 自动添加格式化后的文件到暂存区
    git add -A
  else
    log_warning "Prettier格式化跳过（无匹配文件或未安装）"
  fi

  # 1. ESLint检查（带自动修复）
  log_info "运行ESLint检查..."
  if npx eslint --ext .js,.jsx,.ts,.tsx,.vue src/ server/src/ --fix --max-warnings 0 2>/dev/null; then
    log_success "ESLint检查通过"
    # 自动添加修复后的文件
    git add -A
  else
    log_error "ESLint检查失败"
    failed_gates+=("ESLint")
    quality_passed=false
  fi
  
  # 2. TypeScript类型检查
  if [ -f "tsconfig.json" ]; then
    log_info "运行TypeScript类型检查..."
    if npx tsc --noEmit; then
      log_success "TypeScript检查通过"
    else
      log_error "TypeScript类型检查失败"
      failed_gates+=("TypeScript")
      quality_passed=false
    fi
  fi
  
  # 3. 构建测试（Vercel兼容性）
  log_info "运行构建测试（Vercel环境模拟）..."
  if npm run build; then
    log_success "构建测试通过"
    # 清理构建产物
    rm -rf .next dist build
  else
    log_error "构建测试失败，Vercel部署可能失败"
    failed_gates+=("Build")
    quality_passed=false
  fi
  
  # 4. 单元测试（如果存在）
  if npm run test:ci &>/dev/null; then
    log_info "运行单元测试..."
    if npm run test:ci; then
      log_success "单元测试通过"
    else
      log_error "单元测试失败"
      failed_gates+=("Tests")
      quality_passed=false
    fi
  fi
  
  if [ "$quality_passed" = false ]; then
    log_error "代码质量门禁未通过: ${failed_gates[*]}"
    return 1
  fi
  
  log_success "所有代码质量检查通过！"
  return 0
}

# ============ 第二层：多Agent Commit分析 ============
analyze_agent_commits() {
  log_info "分析多Agent提交历史..."
  
  # 确保远程信息最新
  git fetch origin main &>/dev/null
  
  # 获取当前分支
  current_branch=$(git branch --show-current)
  log_info "当前分支: $current_branch"
  
  # 获取远程main分支最新commit
  main_commit=$(git rev-parse origin/main)
  log_info "远程main分支最新commit: ${main_commit:0:8}"
  
  # 分析commit作者
  echo "" >&2
  log_info "Commit作者分析（最近10条）："
  
  local author_report=$(mktemp)
  git log -10 --pretty=format:"%h|%an|%ae|%s" > "$author_report"
  
  # Agent识别规则
  declare -A agent_map=(
    ["Claude"]="claude|anthropic"
    ["Cursor"]="cursor"
    ["Trae"]="trae"
    ["Antigravity"]="antigravity"
    ["Human"]="你的邮箱|你的用户名"
  )
  
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >&2
  echo "Agent提交统计:" >&2
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >&2
  
  # 统计各Agent提交
  while IFS='|' read -r hash name email subject; do
    agent="Unknown"
    for agent_name in "${!agent_map[@]}"; do
      if echo "$name|$email" | grep -qiE "${agent_map[$agent_name]}"; then
        agent="$agent_name"
        break
      fi
    done
    
    # 颜色标记
    case "$agent" in
      "Claude") color=$BLUE ;;
      "Cursor") color=$GREEN ;;
      "Trae") color=$YELLOW ;;
      "Antigravity") color=$RED ;;
      "Human") color=$NC ;;
      *) color=$NC ;;
    esac
    
    echo -e "${color}[$agent]${NC} ${hash:0:8} - $subject" >&2
  done < "$author_report"
  
  rm "$author_report"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >&2
}

# ============ 第三层：智能对比报告生成 ============
generate_comparison_report() {
  log_info "生成智能对比报告..."
  
  # 创建报告临时文件
  report_file=$(mktemp -d)/pr-report.md
  
  # 使用Claude Code SDK生成深度分析
  # 注意：这需要Claude Code命令行工具已安装
  if command -v claude &> /dev/null; then
    log_info "调用Claude Code进行智能分析..."
    
    # 获取diff内容
    diff_content=$(git diff origin/main...HEAD --stat)
    changed_files=$(git diff origin/main...HEAD --name-only)
    
    # 构建分析提示词
    read -r -d '' analysis_prompt << EOF
请分析以下多Agent协作项目的PR变更，生成详细的合并风险评估报告：

**项目信息**
- 项目目录: $(basename "$CLAUDE_PROJECT_DIR")
- 当前分支: $current_branch
- 远程main: origin/main

**变更统计**
\`\`\`
$diff_content
\`\`\`

**修改文件**
\`\`\`
$changed_files
\`\`\`

**分析要求**
1. 识别各文件修改的Agent来源（commit作者）
2. 评估与main分支的合并冲突风险
3. 检查不同Agent修改间的潜在冲突
4. 评估对现有功能的影响
5. Vercel部署风险评估
6. 给出明确的合并建议（安全/谨慎/需人工审查）

请用Markdown格式输出详细报告。
EOF
    
    # 调用Claude生成报告
    echo "$analysis_prompt" | claude -p > "$report_file"
    log_success "智能分析完成"
  else
    # 降级为简化报告
    log_warning "Claude Code CLI未安装，生成简化报告"
    cat > "$report_file" << EOF
# PR对比报告（简化版）

## 分支信息
- **当前分支**: $current_branch
- **远程main**: origin/main

## 变更摘要
\`\`\`
$(git diff origin/main...HEAD --stat)
\`\`\`

## 修改文件
$(git diff origin/main...HEAD --name-only | sed 's/^/ - /')

## 建议
请手动审查代码变更后决定是否合并。
EOF
  fi
  
  echo "$report_file"
}

# ============ 第四层：用户决策交互 ============
user_decision_flow() {
  local report_file=$1
  
  log_info "等待用户决策..."
  
  # 显示报告摘要
  echo "" >&2
  log_info "对比报告摘要:"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >&2
  head -30 "$report_file" >&2
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >&2
  
  # 提供详细报告文件路径
  echo "" >&2
  log_info "完整报告已保存至: $report_file"
  
  # 发送Server酱通知（如果配置了）
  if [ -n "$SEND_KEY" ]; then
    log_info "发送Server酱通知..."
    curl -s -X POST "https://sctapi.ftqq.com/${SEND_KEY}.send" \
      -d "title=Claude Code: PR分析完成" \
      -d "desp=多Agent协作PR分析完成，请查看对比报告后决策" >/dev/null &
  fi
  
  # 核心决策逻辑：询问用户
  echo "" >&2
  log_warning "请审查对比报告后做出决策:"
  echo "1. 允许push到远程" >&2
  echo "2. 拒绝push（需要修改）" >&2
  echo "3. 生成修复建议" >&2
  
  # 生成hook决策
  cat << EOF
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "deny",
    "permissionDecisionReason": "等待用户审查多Agent PR对比报告: $report_file"
  }
}
EOF
  
  # 退出并阻止push
  exit 0
}

# ============ 主执行流程 ============
main() {
  # 执行质量门禁
  if ! run_quality_gate; then
    log_error "代码质量检查失败，阻止push"
    exit 1
  fi
  
  # 分析Agent提交
  analyze_agent_commits
  
  # 生成对比报告
  report_file=$(generate_comparison_report)
  
  # 进入用户决策流程
  user_decision_flow "$report_file"
}

# 执行主流程
main
