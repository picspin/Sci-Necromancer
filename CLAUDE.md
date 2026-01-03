# CLAUDE.md

# Sci-Necromancer: The Great Migration (Vibe Coding Edition)

## 🎯 核心使命 (Current Mission)

将旧的 React 19 SPA 架构彻底重构为现代化的 **Vue 3 + Next.js (Frontend) + Nest.js (Serverless Backend)**。

- **目标状态**：前端 UI 由 Vue 3 驱动，通过 Next.js 路由，逻辑由 Nest.js Serverless 处理。
- **重构原则**：代码剥离，逻辑下沉，严禁在前端直接调用重型解析库（如 PDF 解析）。

## 🧠 模型编排路由 (Orchestration)

- **Minimax-m2.1 (Default)**: 快速代码转换（React -> Vue）、文档更新、简单 Service 编写。
- **Claude 3.7/4.5 (Thinking Mode)**: 复杂 TypeScript 类型设计、Nest.js 模块架构、Serverless 性能优化。
- **GPT-5**: 深度 Debug 跨框架编译错误、处理 Next.js 15+ 边缘情况。

## 🛠 技术栈规范 (Tech Stack Standards)

### 1. Frontend: Vue 3 + Next.js

- **语法**：强制使用 `<script setup>`、TypeScript、Composition API。
- **状态管理**：迁移 React Context 到 **Pinia**。
- **样式**：Tailwind CSS (JIT mode)。
- **注意**：禁止在 Vue 组件中混入 React Hooks 逻辑。

### 2. Backend: Nest.js (Serverless)

- **目录**：所有逻辑位于 `./server`。
- **约束**：保持函数无状态（Stateless），确保 Tree-shaking 友好，Bundle Size 控制在 50MB 以内。
- **解析**：PDF/Docx 处理必须使用 Node.js 原生库（如 `pdf-parse`），弃用浏览器端解析方案。

## ⚡️ 快捷命令 (Vibe Commands)

- **重构逻辑**：`/migrate-logic [file] -> [target]` (将 lib 逻辑迁移至 Nest.js)
- **转换组件**：`/vue-ify [react-component]` (React 转 Vue 3)
- **诊断**：`/sentry-debug` (联动 Sentry MCP 分析报错)
- **视觉对比**：`/ui-check` (联动 Chrome MCP 对比重构前后的渲染差异)

## 🔧 MCP 工具链

- **Sentry**: 监控 Serverless 冷启动与运行时错误。
- **Chrome DevTools**: 用于迁移过程中的 UI/DOM 状态捕捉与对比。

## 📜 协作守则

- **Less is More**: 优先重用现有逻辑，而非重新发明。
- **CI/CD Awareness**: 每次重构 Nest.js 模块后，运行 `npm run lint` 确保类型安全。
- **Subagents**: 复杂重构任务（如 PDF 处理流水线）建议通过 `/agents` 启动子 Agent 独立执行。

Notes:

- No test framework is present (no jest/vitest config, no test scripts). To smoke-test a single component/page, run the dev server and navigate to UI paths.
- Path alias @ maps to project root (vite.config.ts:9-12, tsconfig.json:24-27).

## Key configuration files

- package.json scripts: root package.json:6-11
- Vite config: vite.config.ts:6-33 (plugins, alias @, dev server port 3000, manual chunks)
- TypeScript config: tsconfig.json:2-31 (strict, bundler moduleResolution, baseUrl, paths)

## High-level architecture (Vue3 迁移版)

- Vue3 application entry and layout:
  - App.vue: 主应用组件，使用 onErrorCaptured 钩子实现错误边界，通过 Pinia stores (useSettingsStore, useAbstractStore) 管理全局状态；渲染 ConferencePanel 组件，以及 AbstractManager 和 ModelManager 的模态框组件，NotificationDisplay 通知展示组件。

- State management via Pinia:
  - stores/settings.ts: 定义默认设置（provider、API keys、model、MCP 配置）并通过 pinia-plugin-persistedstate 持久化到 localStorage。暴露 updateSettings/saveSettings 方法，以及 LocalStorageService 用于持久化操作。
  - stores/abstract.ts 提供摘要工作流状态（在面板组件中按需导入使用）。

- LLM integration layer:
  - composables/useLLM.ts: 从 localStorage 读取 provider 配置（'google' vs 'openai'）并委托给 services/llm/gemini.ts 或 services/llm/openai.ts。暴露 analyzeContent、generateImpactSynopsis、generateFinalAbstract、generateCreativeAbstract、generateImage 方法，以及会议特定的辅助方法。
  - services/llm/openai.ts 实现 OpenAI 兼容的 chat/completions 调用和 SiliconFlow 图像生成（以及可选的 MCP 图像生成路径）。从 localStorage 读取设置（base URL、models）。
  - services/llm/gemini.ts 集成 Google AI (Gemini, Nanobanana) 用于文本/图像工作流。

- Conference module system and routing:
  - modules/conference/ 为每个会议（ISMRM、RSNA、JACC、ER）定义模块，包含指南/类型；ConferenceRegistry 和 ConferenceRouter 管理可用模块和当前选中状态。
- stores/conference.ts 初始化注册表并同步当前激活的会议；提供 switchConference 方法。
- components/ConferencePanel.vue 渲染标签页并加载对应的面板组件。

- Panels for workflows:
  - components/ISMRMPanel.vue、RSNAPanel.vue、JACCPanel.vue 实现分析、类型选择、摘要生成和图表生成工作流，使用 composables/useLLM。

- File processing utilities:
  - services/file/FileProcessingService.ts 和 services/file/file-process/{pdf.ts, docx.ts} 处理上传文件的文本提取。

- Notifications:
  - stores/notification.ts 提供 pub/sub 通知服务；components/NotificationDisplay.vue 使用 TransitionGroup 渲染 toast 通知。

- Internationalization:
  - i18n/\* 和 i18n/index.ts 集成 vue-i18n 和翻译文件。

- Optional MCP tools & cloud persistence:
  - components/SupabaseMCPConfig.vue 配置 Supabase MCP；services/databaseFallbackService.ts 管理本地优先存储，通过可插拔的 DatabaseService 实现可选的云端同步。
- ModelManager (components/ModelManager.vue) 配置 provider keys、base URLs、models 和 MCP 工具开关。

- Serverless Nest.js Backend:
  - backend/src/main.ts 定义 Serverless 函数入口，使用 NestJS 模块化架构；提供 /api/analyze、/api/generate-abstract、/api/generate-image 等 RESTful API 端点，支持 AWS Lambda 或 Vercel Serverless Functions 部署。

## Important docs to consult

- README.md: Quick start, provider setup, MCP Tools overview, and repo documentation pointers.
- QUICK_REFERENCE.md: Common user tasks and shortcuts.
- WORKFLOW.md and WORKFLOW_QUICK_REFERENCE.md: Overall workflow and developer view.
- MODEL_CONFIGURATION_GUIDE.md: Provider setup details and models.
- MCP_TOOLS_GUIDE.md: How MCP tools integrate and how to configure Supabase and image generation tools.
- IMAGE_GENERATION_ARCHITECTURE.md and IMAGE_GENERATION_FLOW.md: Technical details and flow for figure generation.
- lib/llm/WRITING_STYLE_GUIDE.md: Guidance for writing style enforcement.

## Development tips specific to this repo

- When adding features, thread settings via SettingsContext; avoid direct localStorage access outside lib/llm unless necessary.
- Use the lib/llm/index.ts exported functions for all AI operations; they handle provider selection and settings.
- Respect the Conference modules when changing guidelines or types; update lib/conference/modules/\* and ensure ConferenceRegistry reflects availability.
- For image generation, prefer the generateImage entry point so provider/MCP decisions remain centralized.
- Keep path alias '@' consistent across imports to avoid relative path churn.

## Build outputs and static guidelines

- Static conference guideline markdowns reside under public/; built copies under dist/ for reference.
- Vite manualChunks split vendors (react-vendor, ai-vendor, pdf-vendor) for performance (vite.config.ts:18-22).

# Project Context Management

## Key Files

- `src/main.ts` - Application entry point
- `src/api/` - API endpoints
- `src/utils/` - Utility functions
- `tests/` - Test suite

## Important Notes

- **Context Limit**: 200K tokens (mga-claude-opus-4.5)
- **Conversation Memory**: Keep to 10-15 messages max
- **Large Tasks**: Use subagents for code review, documentation
- **Session Management**: Use `/compact` when context gets heavy

## Commands

- `/compact` - Compress conversation history
- `/clear` - Clear conversation (start fresh)
- `/agents` - Manage subagents

## Workflow

1. **Planning**: Discuss approach first
2. **Implementation**: Code in focused chunks
3. **Review**: Use code-reviewer subagent
4. **Documentation**: Use doc-generator subagent
5. **Cleanup**: Use `/compact` before new major task

## Context-Heavy Operations

- Large file analysis → Use subagent
- Multiple file edits → Split into smaller tasks
- Long conversations → Use `/compact` periodically
- Documentation updates → Use doc-generator subagent

## Model Configuration

- Default: mga-gpt-5 (200K context)
- For complex tasks: Use thinking mode (tab key)
- For quick tasks: Use fast models (gh-gpt-5-mini)
  EOF

## 内容政策指南

当遇到内容过滤错误时，请：

1. 重新表述你的请求，避免使用可能被过滤的词汇
2. 将代码片段分解成更小的部分
3. 使用更技术性的语言而不是日常用语
4. 如果涉及敏感话题，添加上下文说明这是出于开发目的

示例：

- ❌ "这个代码有什么问题？"
- ✅ "请分析这个 Python 函数的逻辑错误"
