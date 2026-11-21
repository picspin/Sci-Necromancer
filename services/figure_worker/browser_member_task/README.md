# 会员数据图状态/渲染契约验证

独立DEV入口，不是会员登录或生产功能。实际执行 `memberApiClient`、任务状态机和本机Pyodide；身份、供应商和账务仅在fetch边界模拟，计数不是实际扣分。

1. 根目录运行 `npm run dev -- --host 127.0.0.1 --port 4319 --strictPort --open false`。
2. 打开 `http://127.0.0.1:4319/services/figure_worker/browser_member_task/index.html`，启动固定合成任务。
3. 确认冻结规格后绘图；模拟服务先提交完成再丢响应，页面停在unknown且busy已复位。
4. 恢复原任务后应completed；操作仅plan→complete→status，模拟供应商/渲染/结算计数各1，零余额不能再启动。
5. Playwright MCP可加载本目录interaction-check.js重现状态、图件和320/768/1024/1440px检查。

2026-11-21实测：Chrome157，实际Pyodide314.0.7，固定grouped-bar合成CSV；4204×2362、599.9988DPI。确认前render/debit为0，丢响应后各1，恢复后仍各1；四档宽度无溢出，观察到page error、console warning/error、外站请求均0。评分/Jev预检由其他组件用例覆盖，此harness的元数据是固定预先确认的，不能冒充真实上游判断/真实会员完整端到端验收。

本入口不在生产构建输入；无真实会话、密钥或患者数据。生产入口仍DEV门控关闭，免费原图授权文件、服务端评估绑定及跨刷新历史尚未完成，详见[状态机记录](../../../docs/specs/2026-11-21-member-figure-task-state.md)。
