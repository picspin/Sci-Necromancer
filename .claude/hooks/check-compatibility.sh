#!/bin/bash

# 读取Claude Code传入的JSON输入
input=$(cat)
prompt=$(echo "$input" | jq -r '.user_prompt' 2>/dev/null)

# 检查提示词是否包含plan/规划/新功能等关键词
if [[ ! "$prompt" =~ (plan|planning|规划|新功能|feature|implement) ]]; then
  # 非功能规划场景，直接允许
  echo '{"hookSpecificOutput": {"permissionDecision": "allow"}}'
  exit 0
fi

echo "🔍 检测到功能规划请求，正在检查版本兼容性..." >&2

# 检查git状态
if [ ! -d ".git" ]; then
  echo "⚠️  非Git项目，跳过版本检查" >&2
  echo '{"hookSpecificOutput": {"permissionDecision": "allow"}}'
  exit 0
fi

# 获取当前分支和最新提交信息
current_branch=$(git branch --show-current)
last_commit=$(git log -1 --oneline)
last_commit_msg=$(git log -1 --pretty=%B)

# 检查是否有未提交的更改
if ! git diff-index --quiet HEAD --; then
  echo "⚠️  警告：检测到未提交的更改" >&2
  git status --short >&2
fi

# 读取上一版本的package.json或类似版本文件以获取上下文
if [ -f "package.json" ]; then
  current_version=$(node -p "require('./package.json').version" 2>/dev/null)
  echo "📦 当前版本: $current_version" >&2
fi

# 生成检查报告
cat << EOF >&2
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 版本对接检查报告
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🌿 当前分支: $current_branch
📝 最新提交: $last_commit
💭 提交信息: $last_commit_msg
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ 检查完成，可以开始规划新功能
提示：确保新需求与 '$current_branch' 分支的当前状态兼容

EOF

# 允许操作继续
echo '{"hookSpecificOutput": {"permissionDecision": "allow"}}'
exit 0
