# Jev 后续集成依赖核对

日期：2026-09-22。用途：记录基于当前代码发现的接线依赖；不是已完成功能清单。

## 基础分析不能只替换一个 if

- `lib/llm/index.ts` 的 `analyzeContent`、`analyzeContentForConference`、`analyzeISMRMBundle` 是不同入口，必须分别测试。ISMRM bundle 当前还生成 impact、synopsis、typeSuggestions，不能用仅 categories/keywords 的 Jev 对象假装符合 bundle 契约。需把这些开放式文本生成延后或调整面板，而不是偷偷保留三次 LLM 调用。
- `runAndRecordAnalysis` 仍调用 `requireAnalysisCredits`；旧 `managedTextWorkflow` 仍基于第三次分析判断费用。必须仅在已授权 Jev 会员路径跳过旧规则，未同意用户的原 LLM 路径费用不能被意外移除。
- 当前 `/api/generate` 要求 generation 有 workflowId。`acquireManagedTextCall` 用分析响应注册服务端 workflow。免费 Jev 分析不经过旧 LLM 钱包流程后，必须显式建立合法的新生成任务关系或调整协议；否则会再次出现分析成功却无法生成。
- 客户端的正文 context hash 是会话 UX 键，不是安全缓存或后端所有权依据。服务端使用 canonical input 的加密摘要及 userId。

## 候选注册表必须能在服务端加载

现有 `lib/conference/modules/ISMRMModule.ts` 等模块引用 `lib/llm`，后者依赖浏览器状态。不能直接在 Vercel adapter 中实例化这些 UI 模块。抽出纯数据候选配置供服务器和现有模块共同引用；RSNA、ER、ASCO、ESMO、ISMRM 各有不同返回契约，保留专用规则。ESC 保持开发中，不因为新候选列表而开放。

服务端从会议 ID 决定候选，不接收浏览器任意问题集。任何支持范围、候选数量、模型预算超限都应明确提示，不偷偷裁掉列表尾部造成学科偏差。

## 生成结果评估需要新的版本契约

当前 `ManagedGenerationOutput` 主要只有 text/image、model 等字段；`runManagedGeneration` 在返回前验证并结算，但没有正文、候选摘要的冻结版本或检查状态。post-check 不能仅在前端把 Jev 结果挂到可编辑 textarea：需要 source hash、output hash、版本 ID、阶段状态、模型记录与修订链的服务端绑定。

当前 `/api/generate` 是同步 JSON 返回。要显示真正的草稿→核查→最终状态，必须引入可恢复任务/进度或兼容流式协议；不得用虚假计时器声称服务端已完成某阶段。付款、取消、迟到结果和导出版本应与这套契约一起测试。

## 路由与部署约束

`tests/api/esmImports.test.ts` 当前限制 API 入口共 12 个。新增 consent/status/analysis 功能应复用受控端点分派或明确重新评估部署约束，不能随意增加 Vercel 函数后仅修改测试数字。

数据库政策先作为未暴露服务实现；只有纯服务器候选、前端独立同意、余额/配额、原文授权及上述工作流衔接全部完成时才启用公开 endpoint。安全切片返回不可用不是这些功能已经完成。
