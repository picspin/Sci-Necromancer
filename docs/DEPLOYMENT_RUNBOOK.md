# 功能迭代部署清单

本项目的生产链路是：Supabase（Auth、数据库与 RPC）→ Vercel（`api/` 后端）→ Cloudflare Worker（`worker/index.ts`、`dist/` 前端与同源代理）。合并 PR、Vercel 显示“部署成功”或单独执行 `wrangler deploy`，都不等于三层已运行同一版代码。每次上线先填写下方影响判断，再按实际涉及的层执行；未涉及的层无需重部署。

## 先判断本次改了哪一层

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

## PR #8（Jev、ECR 2027、会员文本模型）上线卡片

- **Supabase：需要。** 本 PR 包含多个追加迁移，最近一项是 [`202609300001_member_text_models.sql`](../supabase/migrations/202609300001_member_text_models.sql)。它让 Jev 工作流接受 DeepSeek V4.1 Flash、GPT-5.6 Terra，同时保留旧 ID 供既有工作流兼容。按 dry-run 的完整待执行清单审核，不要只手工执行最后一个文件。
- **Vercel：需要。** `api/`、`backend/` 与共享模型映射均有变化；确认 `MGA_BASE_URL`、`MGA_API_KEY` 等服务端配置正确。`MGA_TEXT_MODEL` 的新示例默认值是 `deepseek-v4.1-flash`；仅修改 Vercel 环境变量而不重新部署，不会使现有函数实例可靠地采用新值。
- **Wrangler：需要。** 前端选择器、模型偏好迁移与披露逻辑已变；必须从包含本 PR 的提交重新构建，再部署 Worker。会员默认公开选项为 DeepSeek V4.1 Flash，可选 GPT-5.6 Terra；Terra 请求映射到 `mga-gpt-terra-5.6`，PTU 不启用，学分价格不变。
- **启用范围：仍受门控。** Jev 新流程及数据图原型不可因合并 PR 就视为已对会员开放；保持相关 `TYPESAFE_JEV_*` 开关关闭，直至迁移、供应商健康、同意/隐私与计费验收完成。数据图 worker 目前只是本地原型。
- **必须核验：** 会员菜单显示两档新模型；分别完成一次新轮次的分析与生成，核对实际 MGA 请求模型、学分扣减、结果中的模型声明；旧偏好升级后能正确选中对应新档。确认 `/api/health` 仍经 Worker 转发。

每次后续功能交付都应附一句部署结论，例如：`Supabase：需要（迁移名）；Vercel：需要（原因）；Wrangler：需要（需重建）；顺序：数据库→后端→前端；已执行：否；上线验收：待做。` 即使三者都不需要，也明确写“无需生产重部署”。

命令依据：[Supabase CLI `db push` 与 `--dry-run`](https://supabase.com/docs/reference/cli/supabase-db-push)、[Vercel CLI 生产部署](https://vercel.com/docs/cli/deploy)、[Cloudflare Wrangler Worker 部署](https://developers.cloudflare.com/workers/wrangler/commands/workers/)。
