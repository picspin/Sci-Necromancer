# Jev 数据图接线：独立审核与待确认兼容修复

日期：2026-10-31。审核对象是本地 `42b3f51`，不是 PR #18 已上线的证明。没有 push、改动 PR、迁移或部署，也没有调用真实模型。

## 基线核对

用户提供的 `8ec6387601ead980cdb8ca2ccc3230e52aab3441` 是 #16 合并到 `codex/data-figure-distribution-radar` 的 merge commit；GitHub 只读核验显示 PR #18（Enhance clinical figure rendering and validation features）从该分支指向 main，状态 OPEN。它不含 #17 的浏览器工作区及本地 `42b3f51` Jev 接线；不要把 PR 创建视作这些功能均已进入 main。

固定点 diff 为 `git diff 8ec6387601ead980cdb8ca2ccc3230e52aab3441...42b3f51`，两轴主要核查新增 Jev 提交与此前已审核 ISMRM/Pyodide 基线的交互。规范来源为 AGENTS.md 和当前工作约定，需求来源为 `2026-10-30-data-figure-next-slice.md`。缺少独立 issue-tracker 文档，因此直接使用已确认本地需求，不安装额外 tracker 工具。

## Standards

独立规范轴未发现需要修改的明确规范违例或值得额外抽象解决的代码异味：硬性违例 0，启发式整改项 0。共享目录/响应校验有实际两端调用；适配器承担权限或边界验证；生产开关、合成数据及部署说明明确。此轴不重复登记已有依赖漏洞。

## Spec

1. **P1：数据库保存契约不兼容，尚待修复方案确认。** 需求要求复用会员缓存/租约；`figureRouting.ts` 返回数据专用 v2 `policyVersion`，但已存在的 `202609260001_jev_figure_routing.sql` 中 `jev_settle_figure_route` 只接受 v1。成功 Jev 结果会被 SQL 拒绝，handler 随即返回 503。当前 API mock 没有模拟这一数据库限制；76 项相关测试通过不能证明真实 RPC 成功。审核未连接生产数据库，此结论来自确定的代码/SQL 契约比对。
2. **P2：非字符串模板 ID 被隐式转换，已修复。** 需求要求拒绝畸形/未知 ID；`hasOwnProperty` 原先把 `['scatter']`、嵌套数组当作 `scatter`，某些 JSON 对象还触发转换异常。新增直接类型负例与缓存 API 回归先失败；在属性查找前加字符串类型检查后通过。没有改变计费、数据流或增加抽象。

汇总：规范轴 0；需求轴 2，最严重 P1。P2 已修复，不能由此把需求轴整体标为通过，也不能声称数据路由已具备真实调用条件。

本轮验证：P2 新增 6 个类型负例，数组/嵌套数组/不可转换对象在修复前失败，缓存 API 也错误返回 200；修复后目标回归与全量 **103 文件 / 657 项 JS/TS** 通过，`npm run lint`（TypeScript）、`npm run build`、`npm run figures:check` 均通过。构建仍有既有混合导入/大 chunk 告警。未修改 Python 或依赖，本轮没有重新执行 Python/真实 Jev/数据库/浏览器端到端验收。Ablation Pass 仅增加必要的字符串守卫与负例，没有增加新抽象。

## P1 推荐兼容方案（等待用户确认，尚未实现）

1. 输入仍是原有会员、已审批摘要和固定候选；不新增路由、服务或数据库表。
2. `policyVersion` 保持 `jev-figure-routing-v1`，对应现有 SQL/RPC 策略，避免修改已应用迁移。
3. 新增 `contractVersion: jev-data-figure-routing-v2` 明确区分数据建议列表格式，而非继续混用策略与格式版本。
4. 保留数据专用 v2 缓存键/完整结构校验，旧 Choice 和没有契约版本的缓存仍不能重用。
5. 更新前后端类型、严格响应校验、合成案例；示意图响应与缓存不变。
6. 增加覆盖真实迁移版本约束的契约回归，不再单靠 mock `settle` 成功；不连接生产库或调用真实 Jev。
7. 不新增迁移、依赖、密钥、计费或生产入口；完成后重新跑测试、类型、构建及必要浏览器验收。
8. 若用户选择新增数据库迁移的替代方案，则需单独审核 SQL/权限/兼容性和数据库先行发布顺序，不能把旧迁移改名后重跑。

在 P1 关闭前不继续接真实推理 LLM 或生产入口；LLM 规划契约的范围另已提出确认，本文件不视为那一步的授权。

## 部署影响

本轮 P2 修复不需要新 Supabase 迁移；若发布须先部署 Vercel 后端，再从同一提交重建/部署 Cloudflare 前端，因为该校验被两端共用。无新环境变量，数据图生产入口仍硬关闭。烟测关注非字符串 ID/畸形缓存拒绝、正常字符串 ID 成功、示意图无回归；P1 未修复前不能启用数据路由。当前未执行上述生产操作，推送可能触发既有 Cloudflare Git production 集成，须另行授权。
