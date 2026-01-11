#!/bin/bash

# ========= 配置区域 =========
SEND_KEY="SCT55482TA-zKjJCjGxyTH6NJHcXneNraaY"
CHANNEL="wechat"
# ===========================

# 读取Claude Code传入的JSON数据
input=$(cat)
session_id=$(echo "$input" | jq -r '.session_id // empty' 2>/dev/null | cut -c1-8)

# 获取任务信息
get_task_info() {
  if [ -d ".git" ]; then
    recent_commits=$(git log -3 --oneline --no-decorate 2>/dev/null || echo "No commits")
    if ! git diff-index --quiet HEAD -- 2>/dev/null; then
      uncommitted="有未提交更改"
    else
      uncommitted="所有更改已提交"
    fi
    echo "Git状态: ${uncommitted}. 最近提交: ${recent_commits}" | tr '\n' ' '
  else
    echo "非Git项目"
  fi
}

# 发送通知函数
send_notification() {
  local title="$1"
  local project_name
  project_name=$(basename "${CLAUDE_PROJECT_DIR:-$(pwd)}")
  local task_info
  task_info=$(get_task_info)

  # 构建简单的消息
  local desp="项目: ${project_name}
时间: $(date '+%Y-%m-%d %H:%M:%S')
会话: ${session_id}
${task_info}"

  # 发送POST请求 (后台执行，不阻塞)
  curl -s -X POST "https://sctapi.ftqq.com/${SEND_KEY}.send" \
    -d "title=${title}" \
    --data-urlencode "desp=${desp}" \
    >/dev/null 2>&1 &

  echo "通知已发送" >&2
}

# 执行发送
send_notification "Claude Code任务完成"

# Stop hook 只需要输出空 JSON 对象或什么都不输出
# 输出有效的空 JSON 以满足验证要求
echo '{}'
exit 0
