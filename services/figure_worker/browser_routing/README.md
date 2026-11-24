# Jev 数据图建议：浏览器契约验证

此入口只用于开发，真实组件经过实际 `memberApiClient`，但 transport 是明确标注的内存 mock。不会 fetch `synthetic.invalid`，没有生产会话、钱包、模型密钥或真实 TypeSafe 请求。不能把这些分值当作 Jev 准确率评测，也不替代后端身份/RPC测试。

## 复现

在项目根目录运行 `npm run dev -- --host 127.0.0.1 --port 4319 --strictPort --open false`，打开 `http://127.0.0.1:4319/services/figure_worker/browser_routing/index.html`。选择 Scenario、填写目标、审阅 JSON、勾选发送同意，再获取建议。按钮明确选择候选，不自动绘图。

Playwright MCP 的 run-code 工具可加载本目录 `interaction-check.js`（函数定义，非 Node CLI）；若工具的文件访问目录与 worktree 不同，可将同一函数源码作为 `code` 参数执行，不使用旧工作区脚本。页面执行只读 DOM 观察；交互通过原生 Playwright 完成。

## 2026-10-30 验证记录

2026-11-24 审核复测：用 [last-run.json](./last-run.json) 取代此前 v2 历史快照；当前快照记录已验证提交、`assessment:true` 出站、两项 v3 合成评分及浏览器控制台结果。以下是历史记录。

2026-11-21更新：当前harness改为 `assessment:true` / v3，增加长度适切性90.00、内容充分性78.00的固定合成分数，验证会员界面不展示模型名。实际Chrome157重跑interaction-check通过：原有状态/迟到结果/四档宽度和键盘检查保留，观察到page error与外站请求0。这些分数不是上游实际评测；旧last-run历史记录不冒充本次v3。完整环境、回归和部署影响见[本轮记录](../../../docs/specs/2026-11-21-member-figure-workspace.md)。

- 假设：多个独立建议、精确 metadata 确认和手动选择可以接入现有工作区，同时拒绝过期结果和畸形协议，而不上传原始 CSV 或引入计费。
- 配置：固定合成两字段，无随机性；固定 `jev-1.13.0` / `jev-data-figure-routing-v2` 标记仅用于协议测试。浏览器运行环境与依赖版本沿用相邻 `browser_workspace` 的锁定 Pyodide 基线；TypeSafe 调用次数与费用均为 0。真实会员生成、模型质量、性能改进、无代理中国网络可达性不在此验证范围。
- 结果：未勾选不能请求；记录的首个请求仅有 `action`、`kind`、`input.fields`（col_N 别名/类型）及 `input.goal`，不含原始列名/逐行值/数据哈希。返回两项建议后保持未选择，显式点击才选择。目标修改清除审批和建议。
- 结果：空列表、错误图型、202/401/402/403/404/429/503 均可转人工选图；取消、数据切换、身份变化、访问撤销后，即便 mock 故意无视 AbortSignal 返回迟到结果，也不呈现旧建议。
- 结果：320/768/1024/1440px 内容宽度均等于视口宽度，无横向溢出；Tab 从 scatter 到 trend；浏览器无警告/错误。仅本机开发资源请求。
- 结论：确认/选择/取消与协议边界可用，不代表实际 Jev 分类质量、会员计费、生产可用性或免费导出授权已验收。服务端严格 >80、完整候选集验证、缓存版本、会员权限和限流另由 Vitest 合成测试覆盖。

部署：Supabase 无新迁移；未来发布需 Vercel 新契约→同提交 Cloudflare 前端重建，但当前未 push、未部署、不开生产。无新依赖/密钥，原有后端路由开关保持默认关闭；详见项目部署清单。
