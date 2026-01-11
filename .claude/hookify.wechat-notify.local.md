---
name: wechat-notify-on-stop
enabled: true
event: stop
action: allow
---

任务完成通知已配置。

此规则在 agent 停止时触发微信通知。

**配置说明：**

- 通知通过 Server酱 发送到微信
- 包含项目名称、时间和 Git 状态
- 不会阻止 agent 停止

如需禁用通知，将上方 `enabled` 改为 `false`。
