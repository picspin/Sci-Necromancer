#!/bin/bash

# ========= 配置区域 =========
# 在这里填入你的Server酱SendKey
SEND_KEY="SCT55482TA-zKjJCjGxyTH6NJHcXneNraaY"  # ← 替换为你的真实SendKey

# 推送渠道配置 (wechat 或 wecom)
CHANNEL="wechat"  # wechat=微信, wecom=企业微信
# ===========================

# 读取Claude Code传入的JSON数据
input=$(cat)
session_id=$(echo "$input" | jq -r '.session_id' 2>/dev/null | cut -c1-8)

# 获取任务信息（从git提交历史推断）
get_task_info() {
  if [ -d ".git" ]; then
    # 获取最近5条提交
    recent_commits=$(git log -5 --oneline --no-decorate)
    
    # 检查是否有未提交更改
    if ! git diff-index --quiet HEAD --; then
      uncommitted="⚠️ 有未提交更改"
    else
      uncommitted="✅ 所有更改已提交"
    fi
    
    echo -e "**Git状态**\n\`\`\`\n$recent_commits\n\`\`\`\n\n$uncommitted"
  else
    echo "*非Git项目*"
  fi
}

# 构建Markdown格式的消息内容
build_message() {
  local title=$1
  local project_name=$(basename "$CLAUDE_PROJECT_DIR")
  
  cat << EOF
{
  "title": "$title",
  "desp": "### 📋 Claude Code任务完成

**项目**: \`${project_name}\`
**时间**: $(date '+%Y-%m-%d %H:%M:%S')
**会话**: ${session_id}...

---

#### 📝 任务总结

$(get_task_info)

#### 🚀 后续操作

- 查看变更: \`git status\`
- 推送到远程: \`git push\`
- 检查部署: 访问Vercel控制台

---

*来自Claude Code自动化通知*"
}
EOF
}

# 发送通知函数
send_notification() {
  local title=$1
  
  echo "📤 发送微信通知: $title" >&2
  
  # 构建请求数据
  message=$(build_message "$title")
  
  # 发送POST请求
  response=$(curl -s -X POST "https://sctapi.ftqq.com/${SEND_KEY}.send" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "title=${title}" \
    -d "desp=$(echo "$message" | jq -r '.desp')")
  
  # 检查响应
  if echo "$response" | grep -q '"code":0'; then
    echo "✅ 通知发送成功" >&2
  else
    echo "❌ 通知发送失败: $response" >&2
  fi
}

# 执行发送
send_notification "🤖 Claude Code任务完成"

# 返回允许状态
echo '{"hookSpecificOutput": {"permissionDecision": "allow"}}'
exit 0
