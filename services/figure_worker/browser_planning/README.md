# 本地 FigureSpec 规划契约验证

本入口只使用固定合成数据和明确 mock 的字段映射响应，复用真实 Pyodide renderer；不是会员账号、真实推理模型评测或生产入口。

启动 `npm run dev -- --host 127.0.0.1 --port 4319 --strictPort --open false`，访问 `http://127.0.0.1:4319/services/figure_worker/browser_planning/index.html`。先选择图型/风格与场景，审阅元数据并确认，点击 Build mock plan；拿到冻结方案后再次确认，才允许本地绘图。没有真实 SDK/API/计费或授权原图下载。

Playwright MCP run-code 可使用 `interaction-check.js` 的函数源码（非 Node CLI）。数据源是 `fixtures.ts`，原始验收结果为 [last-run.json](./last-run.json)。它覆盖11个图型、五风格轮换、两次确认、缺项/注入/未知列、取消/迟到与四个视口。结果全部是实际本地输出；model mapping 是显式 mock，不作质量、速度或费用比较。

原始CSV只进入本地Worker，模型请求仅含已确认字段摘要。自填别名、目标、统计参数标签仍需用户去标识化。预览隐藏标记不是防复制或科学真实性证明，完整PNG/PDF/SVG/复现包授权仍未接通。

完整设计、实验、测试和部署边界见 [规划契约说明](../../../docs/specs/2026-11-01-figure-planning-contract.md)。本轮不部署；无新Supabase迁移/依赖/环境变量，生产数据统计图继续显示“开发中”。
