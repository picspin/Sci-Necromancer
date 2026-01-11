#!/bin/bash
# 用于在审查报告后快速决策

echo "团队项目PR决策助手"
echo "==================="

# 显示最近生成的报告
report_dir="/tmp/claude-pr-reports"
latest_report=$(ls -t "$report_dir"/*.md 2>/dev/null | head -1)

if [ -n "$latest_report" ]; then
  echo "最新报告: $latest_report"
  echo ""
  echo "报告摘要:"
  head -50 "$latest_report"
else
  echo "未找到PR分析报告"
  exit 1
fi

echo ""
echo "选项:"
echo "1. 允许push (git push)"
echo "2. 拒绝push (中止操作)"
echo "3. 生成修复建议 (调用Claude)"
echo "4. 打开完整报告"

read -p "请选择 (1-4): " choice

case $choice in
  1)
    echo "执行: git push"
    git push
    ;;
  2)
    echo "已中止push操作"
    echo "请修复问题后重试"
    ;;
  3)
    echo "调用Claude生成修复建议..."
    claude -p "基于PR分析报告 $latest_report，生成具体的修复建议和步骤"
    ;;
  4)
    ${EDITOR:-code} "$latest_report"
    ;;
  *)
    echo "无效选项"
    exit 1
    ;;
esac
