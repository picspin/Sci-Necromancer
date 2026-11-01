# 功能迭代部署清单

本项目的生产链路是：Supabase（Auth、数据库与 RPC）→ Vercel（`api/` 后端）→ Cloudflare Worker（`worker/index.ts`、`dist/` 前端与同源代理）。合并 PR、Vercel 显示“部署成功”或单独执行 `wrangler deploy`，都不等于三层已运行同一版代码。每次上线先填写下方影响判断，再按实际涉及的层执行；未涉及的层无需重部署。

## 先判断本次改了哪一层

2026-11-01 数据图钱包基础：新增 `202611010001_member_data_figures.sql`，提供不扣费预留、单任务/限流、成功版本一次结算、零余额免费导出授权及既有扣费/Stripe兼容保护。**未来发布需审核并应用Supabase新迁移；Vercel与Cloudflare不需仅因本切片部署。** 本轮只在临时本地PostgreSQL验证，未应用远端迁移、未push或部署；API/UI和真实模型尚未接通，生产入口继续关闭。无生产变量/依赖/密钥变化；临时测试工具、迁移/权限验证边界、烟测与安全回退见[钱包基础记录](./specs/2026-11-01-data-figure-wallet.md)。不得直接drop新表回退或以本地Auth夹具替代目标Supabase验收。

2026-11-01 FigureSpec规划契约（mock）：新增metadata-only请求、严格映射JSON响应/缺项路径、可信图型/单位/风格/哈希绑定和开发专用真实Pyodide复现。没有真实LLM API、会员计费或原图授权，生产“数据统计图”继续显示开发中，不能仅修改开关上线。**Supabase无新迁移；P1应用修复若发布需Vercel→同提交Cloudflare重建；新增规划harness本身不需要生产发布。** 无新依赖、变量、密钥或套餐。当前未push/PR/迁移/部署，付费API调用为0。未来候选烟测需核验真实RPC保存/缓存、严格字段与缺项、输入变更失效、示意图回归及入口仍关闭；全部实验/测试与未完项见[规划契约卡片](./specs/2026-11-01-figure-planning-contract.md)。本地测试不替代会员结算/原图授权与既有依赖风险的上线审核。

2026-11-01 Jev 数据路由 P1 兼容修复：**Supabase 无新迁移；未来发布需 Vercel 后端→同提交 Cloudflare 前端重建/部署**。保留现有 RPC 策略 `policyVersion=v1`，另以 `contractVersion=v2` 标识数据建议；旧数据缓存仍隔离，示意图响应不变。无新依赖、密钥或环境变量。契约回归对照现有迁移的实际版本/model/provider限制先失败再通过，未启动/连接真实数据库；发布候选中须检验 reserve→Jev→settle→cache，并核对授权/限流与示意图无回归。当前未push、未迁移、未部署、未调用付费模型；数据图生产入口仍硬关闭。后续规划契约仅mock，不因修复本P1就开放会员结算或无水印导出。详见[审核更新](./specs/2026-10-31-data-routing-review.md)。

2026-10-31 独立审核发现 Jev 数据图 P1：新 `policyVersion=v2` 与已应用图型路由 RPC 只接受 v1 的契约冲突，真实成功响应仍会在保存阶段失败。此前“不需要新迁移”的结论不能代替兼容验证；推荐把策略版本与数据契约版本分开，等待用户确认后实施。P2 非字符串 ID 校验已做最小修复：**Supabase 无新迁移；若发布该共享校验，Vercel 先部署、Cloudflare 再同提交重建/部署**；无新环境变量，未push、未改PR、未迁移或部署，生产入口仍关闭。烟测须包含数组/对象 ID、畸形缓存和合法字符串，并确认示意图不回归；P1 未关闭前不得开启数据路由。两轴审核、版本拓扑和候选修复方案见[审核记录](./specs/2026-10-31-data-routing-review.md)。

2026-10-30 数据图 Jev 多候选建议接线：**Supabase 无新迁移；未来发布需要 Vercel 后端部署及 Cloudflare 前端同提交重建/部署。** 本轮已本地实现真实模板目录、一次 11 个独立判断、严格建议值 >80、用户摘要确认/明确选图、取消与缓存版本隔离；没有新增依赖、密钥、环境变量或计费。既有 `TYPESAFE_JEV_DATA_FIGURE_ROUTING_ENABLED` 未设 true 即关闭，本轮未改线上变量；生产数据图入口仍受 DEV 硬门控，不能重部署后自行移除“开发中”。安全顺序：独立审核及依赖安全处理→核对既有图型路由迁移历史→Vercel 候选（路由关闭）→同提交前端重建→获准的合成烟测。重点检查身份/余额/同意/开关、旧缓存、元数据出站内容、示意图无回归及生产入口关闭。已通过651项JS/TS、120项Python、lint/build/资源检查和真实浏览器；线上 TypeSafe、钱包、无水印授权没有验收。当前未push、未建新PR、未迁移或部署；后续push可能触发Cloudflare Git production自动部署，须另行确认。联网依赖审计仍有14 high、1 critical、4 moderate，不能因测试通过而跳过安全修复。详情见[实现与验收记录](./specs/2026-10-30-data-figure-next-slice.md)。

2026-10-30 已审核数据图堆叠分支归拢：以当前 `main`（`75206d3`，含 ISMRM #15）合并数据图分支（`a05e072`，含 #17），保留原提交历史，不重做新功能或开启生产入口。相对当前 main：**Supabase 无新增迁移；Vercel 无新增后端部署需求；若发布归拢版本，Cloudflare 前端须从同一提交重建/部署。** 若 #15 后端尚未正式发布，应沿其独立卡片处理，不把本次前端归拢当作后端已上线。无新增密钥、套餐、计费或开关启用；`VITE_BROWSER_DATA_FIGURES_ENABLED` 仍只作用于开发模式。安全顺序为审核合并结果→核对历史迁移/后端发布状态→npm ci/资源准备→test/lint/build/资源检查→经另行授权后才发布Worker。已验证617项JS/TS、120项Python及类型检查/构建；烟测关注ISMRM2027目录和数据图开发入口同时存在、生产入口保持关闭、同源资产不是SPA HTML。不调用付费模型，不使用患者数据。当前仅本地合并验证，未push、未应用迁移或手动部署；后续push前须提醒Cloudflare Git集成可能自动触发production部署。

2026-10-29 ISMRM 2027 年度模板、分类及盲审规则更新（规则核对日期2026-10-11）：**Supabase 无需迁移；Vercel 需要部署；Cloudflare Worker 需要重建并部署**。无环境变量或计费变化，安全顺序为审核目标提交→Vercel后端→同提交 `npm run build`→Worker；核验当前投稿链接、主/次子分类与关键词、Tandem类型、Clinical Synopsis和年度缓存/盲审规则，并核验会员Jev已用完整目录及扩大问题集的实际延迟/用量。授权范围是独立提交、push与创建PR，不包含生产部署；统计图、容器及依赖修改不纳入本增量。只读依赖审计报告既有7项high、1项critical，生产发布前须单独排查/修复，不以本地回归通过代替安全验收。完整来源、兼容与验收边界见[ISMRM 2027 更新记录](./specs/2026-10-11-ismrm-2027.md)。

2026-10-29 Pyodide正式执行层/数据图工作区本地接入：**Supabase无需迁移；Vercel无需部署；若发布本前端切片，Cloudflare Worker需重建并部署；仅提交/推送/PR、不执行生产操作。** 固定npm Pyodide314.0.7，新增`figures:prepare`/`figures:check`及predev/prebuild同源资源准备。首次构建机需联网下载并校验锁定wheel，用户浏览器只加载同源资源；无新增密钥/套餐。开发变量`VITE_BROWSER_DATA_FIGURES_ENABLED=true`用于有余额测试会员，正式生产构建仍硬性关闭入口，不能当作会员结算/官方免费导出已完成。安全顺序：审核提交→npm ci→prepare/test/lint/build/check→未来另行获准后才部署Worker；检查生产入口关闭、原功能无回归和WASM/锁/包资源非SPA HTML，本地合成验证不消耗学分。完整边界、未完成项与依赖审计见[工作区接入卡片](./specs/2026-10-29-browser-data-figures.md)。以下兼容探针记录属于此前切片，不代表本次没有依赖或前端改动。 独立PR回归599项JS/TS、120项Python；已补核心资源完整性与2/3/4面板浏览器验证。

2026-10-06 多面板和首个放射影像合成案例：**Supabase 无迁移；Vercel 无需部署；Cloudflare Worker 无需重建/部署**。仅未接入生产的 Python 组合入口、例子、测试和文档，无新依赖/环境变量/开关/扣费变化。无本增量的生产发布顺序或付费烟测需求；锁定 Python 115 项回归、例子三格式/manifest 导出、JS/TS test/lint/build 为本地验收。生产操作已执行：无，分支尚未 push；后续 push 会受现有 Git 集成影响，需另行确认，不据构建成功移除“开发中”。详情见[本地多面板记录](./specs/2026-10-06-data-figure-multipanel.md)。

2026-10-05 PR #13/#14 审查修复仍限于本地 Python 图件、测试和文档，**Supabase 无迁移；Vercel 无需部署；Cloudflare Worker 无需重建/部署**，无环境变量变更，也不启用会员数据图入口。锁定 Python 回归、三格式合成导出和前端 test/lint/build 是本地验收步骤，无本修复的生产发布顺序或付费烟测需求；未运行生产迁移/部署命令。注意现有 PR bot 已显示 Vercel/Cloudflare 自动构建记录（Cloudflare 链接含 production）：push 前确认外部 Git 集成的发布范围，不能把“未手动执行部署”写成“没有自动部署”，也不能把自动构建成功视为会员功能已上线。

| 变更内容                                                                               | 需要操作                                        | 不应误认为                                       |
| -------------------------------------------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------ |
| `supabase/migrations/` 中新增 SQL、数据库函数或约束                                    | 审核并应用待执行迁移                            | 重新部署 Vercel 会自动迁移数据库                 |
| `api/`、`backend/`、`vercel.json` 或 Vercel 服务端环境变量                             | 部署对应 Git 提交的 Vercel 后端                 | 对两周前的部署点“Redeploy”会带上最新代码         |
| `src/`、`public/`、`worker/`、`wrangler.jsonc`、`.env.production` 或 `VITE_*` 构建变量 | 从目标提交重新 `npm run build`，然后部署 Worker | 只运行 `npx wrangler deploy` 会重新编译 Vue 前端 |
| `lib/`、`types.ts` 等前后端共享文件                                                    | 检查导入方；通常 Vercel 与 Worker 都要更新      | 只改了一处共享文件就只需部署一个服务             |
| 仅文档或测试                                                                           | 不需要生产重部署                                | 提交/合并本身改变线上行为                        |

服务端密钥只放 Vercel；浏览器可见的 `VITE_*` 值在构建时进入前端。不要把 `SUPABASE_SERVICE_ROLE_KEY`、`MGA_API_KEY`、`GOOGLE_API_KEY` 等写进 `VITE_*` 或提交进仓库。当前前端必须用 [wrangler.jsonc](../wrangler.jsonc) 的 Worker 部署，不能仅上传 `dist/` 到 Pages：Worker 负责 `/api/*` 和 `/supabase/*` 的同源代理。

## 通用上线顺序

1. **确定发布提交。** PR 审核后记录要上线的 commit SHA；确认本地构建、Vercel 生产部署、Cloudflare Worker 指向同一发布版本。若使用 Vercel Git 自动部署，核对其 Production deployment 的 SHA；不要在旧 deployment 上点 Redeploy 代替新提交发布。部署前运行 `npm ci`、`npm run lint`、`npm test -- --run`、`npm run build`，并检查构建所用的公开环境变量。
2. **先处理向后兼容的数据库迁移（如有）。** 核对 Supabase CLI 链接的项目确实是目标项目，检查 `supabase/migrations/` 的所有待执行文件及数据影响。使用已安装的 CLI 先运行 `supabase db push --dry-run`；结果符合预期后再运行 `supabase db push`。该命令会应用所有待执行迁移，不只应用本次 PR 的文件；如清单含意外迁移，先停下核查。不要对远端生产库运行 `supabase db reset --linked`。若合并会触发 Vercel 自动上线，应在合并/自动晋升之前完成兼容迁移，或先暂停自动晋升。
3. **部署后端（如有）。** 先确认 Vercel 项目、Production 环境变量与本次代码匹配。可让 Git 集成部署目标提交；若使用 CLI，则在已链接到正确项目、且仅含目标提交的干净 checkout 执行 `vercel deploy --prod`。在 Vercel 后台核对 Production deployment 的 commit SHA、函数日志及 `/api/health`，不要把 Preview 成功当作 Production 已上线。
4. **重建并部署前端 Worker（如有）。** 在同一个目标提交的 checkout 中执行 `npm run build`，检查 `dist/` 已更新且生产公开变量仍在，再执行 `npx wrangler deploy`。`wrangler.jsonc` 同时定义 Worker、静态资源和 `www.rad-sci.org` / `rad-sci.org` 自定义域名；不要改用 `wrangler pages deploy dist`。如果修改了 `VITE_*`，必须重新 build，即使 Worker 源码未改。
5. **上线后验收。** `curl -i https://www.rad-sci.org/api/health` 应返回 JSON，而不是 SPA HTML，并带有 `X-Sci-Proxy: member-api`。检查首页、会员注册/登录与余额、一次实际会员分析→生成→深度更新、学分变动与 AI 模型披露；对涉及生图的版本另测生图及回退。任何付费烟测应使用明确的测试账户，记录实际扣分，不使用真实用户数据。查看 Vercel 函数日志和浏览器 Network 中 `/api/*` 的响应；不要只依据浏览器里无关的 CDN/扩展报错判断业务成功。
6. **失败时回退。** 停止继续推广新前端，使用已知正常的 Vercel/Worker 发布版本回退代码；已应用的兼容性数据库迁移通常保留，不要直接删除列或重置生产库。检查失败请求是否已结算/退款，再安排修复。任何会改变既有数据的逆向 SQL 都需要单独审核。

## 2026-10-01：会员请求 500 的后端导入修复

Vercel 生产日志表明，`conferenceBlindReviewRules.js` 中未被改写的 `@/lib` 导入导致 `ERR_MODULE_NOT_FOUND`。`/api/generate` 和 `/api/member/capabilities` 在调用 MGA 前就失败；这是函数加载故障，不是 Terra 上游不可用。共享规则改用显式 `.js` 相对路径，保留模型映射和计费行为。

回归：`tests/api/serverlessImportContract.test.ts` 编译全部 `api/` 入口，再由普通 Node 加载，避免 Vite 的 alias 解析掩盖服务端错误。它是本地回归，不替代实际 Vercel 发布产物检查和线上验收。

本次导入修复：**Supabase 无新迁移；Vercel 需要部署含修复的提交；Cloudflare 无需仅因导入路径变化重建/部署**（前端解析到的规则内容不变）。无环境变量变更。先部署后端候选并验证生成/capabilities 无加载崩溃，再晋升和通过站点代理验证会员生成及实际学分。修复尚未发布到生产。

自动化发布的后续方案见[Agent 发布工作流设计](./specs/2026-10-01-agent-release-workflow.md)。它目前是待确认设计，不是已启用的发布系统。

## 2026-10-01：数据统计图本地模板增量

上一批新增原始热力图、数值趋势、点区间和森林图，并将合成数据 Python 测试加入 CI。本轮继续增加排名棒棒糖、严格分母的计数/百分比构成图、已有结果火山图，均连接严格 CSV/FigureSpec 校验与三格式导出。九类基础模板、66 项 Python 合成数据测试的本地验证通过，不代表完整模板目录或会员执行链路已经实现；详细状态见[数据图设计与进度](./specs/2026-09-20-member-data-figures-design.md)。

本增量 **Supabase：无迁移；Vercel：无需部署；Cloudflare Worker：无需重建或部署**。原因是仅修改尚未被生产 API 调用的本地 Python 原型、测试、CI 与文档；没有环境变量变化、生产开关变化或在线资源创建。当前无生产发布顺序或线上付费烟测需求。验证命令为 `uv sync --project services/figure_worker --locked`，再运行 `uv run --project services/figure_worker --no-sync python -m unittest discover -s services/figure_worker/tests -v`；同时保留 JS/TS test、lint、build 检查。CI 运行与 push 都不启用会员数据图入口。

与本增量分开的会员 500 导入修复仍需用户部署 Vercel。当前数据图没有自动部署动作；后续 worker 承载平台、成本、区域和任务/计费方案通过审核后，另附数据库→后端/worker→前端的上线卡片，不能仅重部署 Vercel 就移除“开发中”。

## 2026-10-01：数据图期刊风格增量

新增本地 Python worker 的 Standard/Lancet/Nature/Cell/NEJM-inspired 白名单风格、FigureSpec 冻结版本和哈希；九类模板共用外观层，统计输入与计费规则不变。详细边界与合成验证见[期刊风格记录](./specs/2026-10-01-data-figure-journal-styles.md)。

本增量 **Supabase：无迁移；Vercel：无需部署；Cloudflare Worker：无需重建/部署**。仅本地原型、测试、文档变化，无环境变量变更，尚未连接生产 API/UI。无需生产发布顺序或线上付费烟测，已执行生产操作：无。71 项 Python、586 项 JS/TS 测试、lint/build 通过；合并/push 不启用数据图入口。此前的会员 500 修复和后续完整数据图上线卡片仍分别适用。

## 2026-10-02：分布与雷达基础模板

本地新增分布箱线＋全观测和逐轴严格归一化雷达，后者提供原值 CSV 附件；十一类基础图型均有首个本地变体，87 项 Python、586 项 JS/TS 测试、lint/build 通过。具体限制、方法与待完成内容见[分布/雷达记录](./specs/2026-10-02-data-figure-distribution-radar.md)。

**Supabase：无迁移；Vercel：无需部署；Cloudflare Worker：无需重建/部署。** 仅未接入生产的 Python 原型、测试和文档变更；无环境变量变化。无本增量的生产发布顺序或付费烟测需求；生产操作已执行：无。不得仅靠重部署移除会员数据图“开发中”。后续上传/隔离执行/持久任务/钱包/前端上线需单独审核与发布卡片。

## 2026-10-04：固定分箱直方图

分布本地模板增加 `distribution-histogram-v1`，显式边界、全观测计数与期刊 inspired 外观，原箱线版本保留。契约、合成验证与复现示例见[直方图记录](./specs/2026-10-04-data-figure-histogram.md)。

**Supabase：无迁移；Vercel：无需部署；Cloudflare Worker：无需重建/部署。** 仅未被生产调用的 Python 原型、测试和文档变更，无环境变量或生产开关变化；生产操作已执行：无。无本增量的生产发布顺序或付费烟测需求。本地烟测为锁定 Python 全套测试、示例三格式导出与实际预览；JS/TS test、lint、build 同时回归。会员入口继续“开发中”，后续任务/钱包/隔离 worker/前端接通另附上线卡片。

## 迁移语法报错后继续执行

`supabase db push --dry-run` 只列出待执行文件，不会在 PostgreSQL 中编译或执行 SQL，因此不能证明迁移语法正确。SQL 修复应先在隔离的本地数据库中验证完整迁移链；Jev 分析限流的运行时回归测试为 `supabase test db supabase/tests/jev_member_policy.test.sql`，需本地 Supabase 已启动并应用全部迁移。

普通事务型迁移失败会回滚该文件，之前成功提交的文件保留。先核对远端迁移历史及对象状态，再修复尚未应用的原始文件。对于 `202609220001_jev_member_policy.sql` 的 `case` 语法错误，若历史已包含 `202608110001`，但不包含 `202609220001`，且 Jev 分析表与函数不存在，修复后应剩余 5 个待执行文件（从 `202609220001` 到 `202609300001`）。无需手动删除表、重复执行已完成文件或用 `migration repair` 标记失败文件为已应用。

在项目根目录的本机终端运行以下命令（不是 Supabase SQL Editor），核对 dry-run 清单后才执行 push：

```bash
supabase migration list --linked
supabase db push --dry-run --linked
supabase db push --linked
supabase migration list --linked
```

完成后 Local 与 Remote 应全部对应。此次 SQL 语法修复需要 **Supabase：继续应用待执行迁移**；**Vercel：无需因本修复重部署**；**Wrangler：无需因本修复重建或部署**；无环境变量变更。PR #8 的前后端代码若尚未上线，仍按其上线卡片发布；本地测试与只读核对不等于已应用生产迁移。

2026-10-01 只读核对：用户自行应用迁移后，远端已记录全部 11 个本地版本，最新为 `202609300001`；该项目无需因上述语法修复重复 push。此记录不替代其他项目或未来发布的实时核验。

## PR #8（Jev、ECR 2027、会员文本模型）上线卡片

- **Supabase：需要。** 本 PR 包含多个追加迁移，最近一项是 [`202609300001_member_text_models.sql`](../supabase/migrations/202609300001_member_text_models.sql)。它让 Jev 工作流接受 DeepSeek V4.1 Flash、GPT-5.6 Terra，同时保留旧 ID 供既有工作流兼容。按 dry-run 的完整待执行清单审核，不要只手工执行最后一个文件。
- **Vercel：需要。** `api/`、`backend/` 与共享模型映射均有变化；确认 `MGA_BASE_URL`、`MGA_API_KEY` 等服务端配置正确。`MGA_TEXT_MODEL` 的新示例默认值是 `deepseek-v4.1-flash`；仅修改 Vercel 环境变量而不重新部署，不会使现有函数实例可靠地采用新值。
- **Wrangler：需要。** 前端选择器、模型偏好迁移与披露逻辑已变；必须从包含本 PR 的提交重新构建，再部署 Worker。会员默认公开选项为 DeepSeek V4.1 Flash，可选 GPT-5.6 Terra；Terra 请求映射到 `mga-gpt-terra-5.6`，PTU 不启用，学分价格不变。
- **启用范围：仍受门控。** Jev 新流程及数据图原型不可因合并 PR 就视为已对会员开放；保持相关 `TYPESAFE_JEV_*` 开关关闭，直至迁移、供应商健康、同意/隐私与计费验收完成。数据图 worker 目前只是本地原型。
- **必须核验：** 会员菜单显示两档新模型；分别完成一次新轮次的分析与生成，核对实际 MGA 请求模型、学分扣减、结果中的模型声明；旧偏好升级后能正确选中对应新档。确认 `/api/health` 仍经 Worker 转发。

每次后续功能交付都应附一句部署结论，例如：`Supabase：需要（迁移名）；Vercel：需要（原因）；Wrangler：需要（需重建）；顺序：数据库→后端→前端；已执行：否；上线验收：待做。` 即使三者都不需要，也明确写“无需生产重部署”。

命令依据：[Supabase CLI `db push` 与 `--dry-run`](https://supabase.com/docs/reference/cli/supabase-db-push)、[Vercel CLI 生产部署](https://vercel.com/docs/cli/deploy)、[Cloudflare Wrangler Worker 部署](https://developers.cloudflare.com/workers/wrangler/commands/workers/)。
