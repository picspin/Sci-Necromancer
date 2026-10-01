# Agent 发布工作流设计

日期：2026-10-01。状态：设计待确认；尚未实现发布脚本、配置部署凭据或执行生产发布。

## 设计草稿

1. 输入：已审核的目标 commit SHA、上次成功发布记录、目标项目标识及本次发布授权。
2. 输出：部署影响清单、验证结果、迁移版本、Vercel deployment ID、Worker version ID 和脱敏验收回执。
3. Agent 负责判断影响、准备清单、解释失败；发布执行器只运行固定命令，不执行模型生成的任意 shell。
4. 使用当前 npm 锁文件与 Supabase/Vercel/Cloudflare CLI；不增加业务运行时依赖。
5. 数据库先于依赖新 schema 的后端，后端先于依赖新 API 的前端；未涉及的层跳过。
6. PR 审核不等同于生产授权：一次批准绑定完整发布清单及 SHA，之后无需逐条手工输入命令。
7. 测试 CI 不接触生产密钥；独立发布环境使用最小权限凭据、串行锁、超时和审计记录。
8. 任一步失败停止后续发布；不自动重置数据库、修改迁移历史、改 DNS 或购买资源。

## 为什么需要独立发布门控

现有 `.github/workflows/ci.yml` 只执行测试、类型检查与前端构建，没有三端发布执行器。Vercel Git 集成可能在 main 更新时单独发布后端，因此必须先确定它与统一发布流程的关系，不能让两条生产发布链同时竞争。

此次事故证明“构建 READY”不足以证明函数可用：main 的 `156b4aa954a1c7a33b596fba228193788b121943` 部署在加载 `conferenceBlindReviewRules.js` 时保留了 `@/lib` 导入，`/api/generate` 与 `/api/member/capabilities` 在调用 MGA 之前退出。新的 serverless import 回归测试将所有 `api/` 入口编译后交给普通 Node 加载；仍需对实际 Vercel 构建产物及候选部署进行验收。

## 发布清单与审核

使用一个固定格式的 JSON 清单，不在清单里保存密码、访问令牌或数据库连接串：

- 仓库、目标 SHA、上次成功 SHA；在干净 checkout 中构建，不能发布本机无关改动。
- 三层影响及理由；共享模块逐个检查导入方，依赖/配置变更采用保守判断；纯文档不触发部署。
- Supabase 项目 ref、Vercel team/project ID、Worker account/name 和目标域名白名单。
- 全部待应用迁移的版本与 SHA-256，不仅是本次 PR 的 SQL；已应用文件不允许静默改写。
- CLI/Node/Python 版本、公开构建变量名称、服务端变量变更名称、必要开关状态。
- 测试与构建证据、候选部署 ID、上个正常代码版本、烟测步骤及付费测试预算。

未知影响、项目不匹配、远端 schema 漂移、额外待执行 SQL、凭据不足、SHA 或清单变化均停止。清单批准后若代码或迁移变化，批准失效。迁移的语法修正若仅发生于尚未应用版本，先验证远端历史再处理，不使用 `migration repair` 掩盖失败。

首版建议由 Agent 在本机生成清单并执行已批准发布；准备好独立发布环境后，再增加绑定 SHA 的 `workflow_dispatch` 入口。不要把生产密钥传给普通 PR CI，尤其是 fork PR。本机交互认证、CI token 认证分别检查，不能因命令可执行就假设有发布权限。

## 执行顺序

### 1. 无生产写入的预检

确认目标提交的审核与 CI 结果，运行 `npm ci`、`npm run lint`、完整测试、依赖安全检查及 `npm run build`。运行现有 serverless import 回归，并检查实际 Vercel 产物。涉及 Python 数据图时，增加锁定环境的合成数据渲染测试。

涉及 SQL 时，在一次性本地 Supabase/PostgreSQL 中验证完整迁移链和数据库测试；`db push --dry-run` 只列清单，不代替 SQL 编译或运行测试。检查备份/恢复条件与向后兼容性；破坏性或不兼容迁移另行设计，不纳入通用自动发布。

### 2. 数据库（仅有待执行迁移时）

只读核对远端版本，运行 `supabase db push --dry-run --linked`，将结果与批准清单逐项比对。应用前再次核对版本与文件哈希，再执行 `supabase db push --linked`，完成后复查历史、关键对象、RLS 与 RPC 权限。

重试之前先重读历史，判断哪些文件已提交，不能盲目重复推送。代理 Fake-IP、IPv6/网络失败应明确报告，不改全局网络配置、不以修复历史命令替代真实迁移。

### 3. Vercel 后端（仅受影响时）

在固定项目的隔离 checkout 拉取配置，服务端变量不得混入前端构建或发布日志。使用 `vercel build --prod` 生成 `.vercel/output`，检查实际函数加载；通过 `vercel deploy --prebuilt --prod --skip-domain` 创建尚未晋升的生产候选部署。候选部署烟测通过后才 `vercel promote`。

晋升前验证候选 ID、项目、清单 SHA 与构建证据；不从旧 deployment 随意 Redeploy。候选保护使用受限验收凭据，不为测试解除全站保护。若 Git 集成仍自动晋升 main，先单独批准并关闭该晋升路径或调整触发策略；未消除竞争前，不宣称统一流程已经生效。

### 4. Cloudflare Worker 前端（仅受影响时）

从同一 SHA 重建 `dist/`。必须连同 Worker 代理发布，不能把项目当纯静态站上传：保持 `ASSETS`、SPA 回退、`run_worker_first`、`API_ORIGIN`、`SUPABASE_ORIGIN` 与两个自定义域名的既有语义。

`cf` 官方已提供配置迁移及 Worker 发布，部分构建会委托 Wrangler。首步使用固定版本 CLI 进行身份/账号/现有版本与域名的只读核验；Worker 实际发布先保留现有 Wrangler 路径。随后在隔离分支运行 `cf migrate`、审核转换 diff 并做候选环境验收，确认代理与资源路由等价后切换到 `cf deploy`。不要直接在生产 checkout 自动执行 `cf init/deploy`，也不要把迁移失败静默降级为另一种发布。

不新建/删除 DNS 记录，不自动修改自定义域名绑定，不安装新生产依赖。CLI 版本与权限通过预检固定；工具更新属于单独审核项。

### 5. 跨端验收与失败处理

- 检查 Vercel 候选/生产及 `https://www.rad-sci.org/api/health`；后者应为 JSON 且带 `X-Sci-Proxy: member-api`。
- 使用未登录的受保护 API 检查，确认返回预期鉴权错误而不是加载崩溃；再用专用测试会员验证 capabilities、余额、模型菜单及必要生成链路。
- 涉及模型/计费时，使用批准的合成输入验证实际输出、模型披露、学分流水、幂等/退款；必须记录真实结果，不仅断言 HTTP 200。
- 连续观察限定时间的函数日志；CLI 发布成功但烟测失败记为发布失败。
- 后端失败不发布新前端；前端失败记录混合版本状态。回滚到记录中的已知正常代码版本时先检查 schema/API 兼容性，不直接回滚数据库。付费请求可能已执行时先对账，不重复发起。
- 清理发布环境中临时拉取的密钥文件；回执只留 SHA、版本/部署 ID、测试结果、时间与脱敏错误。

## 分阶段实施与验收

1. 实现只读发布计划、变更影响测试与 CLI 预检；尚不执行生产命令。
2. 接入隔离的完整迁移测试、实际 Vercel 构建检查及 mock CLI 顺序/失败测试。
3. 在测试环境跑通发布执行、烟测、回执与代码回滚；验证并发锁、清单篡改及错误项目拒绝。
4. 经确认配置专用发布凭据与批准入口，再由 Agent 执行首次生产发布；可选 GitHub 发布入口在本机流程验收后加入。
5. `cf` 配置迁移作为独立迭代，通过路由等价测试后切换；不与此次 500 修复绑定。

本设计确认后才实施新执行器和权限配置；当前文档无需任何生产重部署。

## 数据统计图的独立交付状态

当前不是缺少一个发布开关：数据图入口写死禁用，Python 仅有 CSV 校验、`grouped-bar` / `scatter` 本地导出；Jev 图路由只提供分类，不能执行图件任务。现有设计的 11 图型/12 临床案例仍是交付目标。

正式开放前还需：私有上传与文件过期、独立受限 Python 执行环境、持久任务/失败恢复、成功版本计费与幂等、前端字段映射/确认/下载、字体覆盖及剩余模板。基础设施选择需另行确认，不通过启用 Jev routing 开关冒充渲染服务上线。参见[会员数据图设计](./2026-09-20-member-data-figures-design.md)。

## 官方依据

- [Cloudflare cf 发布与迁移说明](https://blog.cloudflare.com/cloudflare-cf-cli-launch/)
- [Vercel 本地构建](https://vercel.com/docs/cli/build)、[预构建发布与 skip-domain](https://vercel.com/docs/cli/deploy)
- [Supabase db push 与 dry-run](https://supabase.com/docs/reference/cli/supabase-db-push)

命令实施时仍需核对所固定 CLI 的 `--help`；本设计中的候选环境流程尚未在本项目运行。
