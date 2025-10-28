🧩 项目概述 | Project Overview

中文：
本项目是一个基于大语言模型（LLM）的自动化学术投稿生成与分析系统。系统可根据不同学术会议或期刊（如 ISMRM、JAMA、The Lancet 等）的要求，自动生成、提取并改写论文摘要，同时支持图片优化与排版。
系统旨在为科研人员与医学影像学研究者提供智能化的论文摘要撰写辅助，包括：
	•	文本自动摘要与分段（Impact / Synopsis / Keywords）
	•	图片生成与自动规格适配（传统上传模式与创意生成模式）
	•	针对会议/期刊的规范化模板（如 ISMRM guidelines）
	•	可拓展的多语言与多模态支持

English:
This project is an LLM-powered academic submission generation and analysis system. It automates the creation, extraction, and rewriting of scientific abstracts according to customized conference or journal specifications (e.g., ISMRM, JAMA, The Lancet).
It provides researchers and medical imaging professionals with intelligent authoring tools for:
	•	Automatic text summarization (Impact / Synopsis / Keywords)
	•	Figure optimization and formatting (traditional upload & AI creative modes)
	•	Compliance with submission guidelines (e.g., ISMRM specs)
	•	Extendable multilingual and multimodal support

⸻

⚙️ 技术栈 | Tech Stack

Frontend:
	•	Next.js (App Router)
	•	React 18+
	•	TypeScript
	•	Tailwind CSS
	•	Chakra UI

Backend:
	•	Node.js
	•	Database Layer: Supabase / Prisma / Knex (adaptively integrated per use case)
	•	Minimal entity design — follow “build only when necessary” principle

AI Integration:
	•	Google AI (native integration)
	•	OpenAI API

Internationalization:
	•	i18next

Build Tools:
	•	npm / pnpm / bun

⸻

🧠 MVP核心架构 | MVP Core Architecture

📊 Workflow 架构 (Mermaid Diagram)

flowchart TD
  subgraph A[Digesting Part]
    A1[txt/pdf/word Upload or Text Input] --> A2[LLM Analysis → Suggest Abstract Type]
    A2 --> A3[Extract Sections: Impact / Synopsis / Categories & Keywords]
    A3 --> A4[ISMRM/Clinical/ISRMT Spec Routing via Guideline Router]
    A4 --> A5[Output Structured Abstract JSON]
    A5 -->|可拓展| A6[Generate Summary or Extended Abstract (邪修模式)]
  end

  subgraph B[Image Part]
    B1[Upload Image + Specs Prompt] --> B2[LLM Integration (NanoBanana/SiliconFlow Kolors)]
    B3[Inherit A6 Generated Abstract + Specs Prompt] --> B4[LLM-based Image Synthesis]
  end

  A -->|文本与图像联合优化| B
  B -->|输出结果| C[Final Abstract Package Export (PDF/Docx/JSON)]


⸻

🧩 模块结构 | MVP Directory Structure

/src
├── app/
│   ├── api/
│   │   ├── llm/
│   │   ├── file/
│   │   ├── export/
│   │   └── ...
│   └── page.tsx
├── components/
│   ├── editor/
│   ├── export/
│   ├── image/
│   └── ...
├── hooks/
│   ├── useLLM.ts
│   ├── useFileUpload.ts
│   └── usePromptRouter.ts
├── lib/
│   ├── llm/
│   │   ├── core/
│   │   │   ├── index.ts
│   │   │   ├── providers/
│   │   │   │   ├── openai.ts
│   │   │   │   ├── googleai.ts
│   │   │   │   └── ...
│   │   ├── prompts/
│   │   │   ├── ismrmguideline.ts
│   │   │   └── clinical.ts
│   ├── file/
│   │   ├── file-process/
│   │   │   ├── pdf.ts
│   │   │   ├── docx.ts
│   │   │   └── txt.ts
│   ├── services/
│   ├── utils/
│   ├── db/
│   └── index.ts
├── public/
├── styles/
└── types/


⸻

🧪 Dev Environment Tips
	•	推荐 Node.js ≥ 20.0
	•	使用 pnpm 进行包管理（速度更快，依赖更干净）
	•	在 .env.local 中配置以下变量：

OPENAI_API_KEY=your_key
GOOGLE_AI_KEY=your_key
SUPABASE_URL=...
SUPABASE_KEY=...


	•	运行：

pnpm install
pnpm dev



⸻

🧬 Testing Instructions
	1.	使用 Jest + React Testing Library 进行单元与集成测试
	2.	文件上传与LLM接口使用 Mock 模式测试
	3.	对各specs（如ISMRM）的输出格式进行 snapshot 测试
	4.	在 __tests__/ 目录下创建文件并运行：

pnpm test



⸻

🧾 Code Style

General Guidelines
	•	遵循 清晰性优先于简洁性 原则
	•	使用现代 ES 特性：async/await、for...of、.map()、.flatMap()
	•	禁止使用 .reduce() 进行复杂数据转换
	•	尽量避免使用 Promise 的 .then() / .catch()，改用 async/await
	•	错误处理复杂时，使用 Inbox Aschange（来自 es-toolet 的异常处理工具）
	•	所有命名采用 camelCase，组件名为 PascalCase

⸻

TypeScript Guidelines
	•	使用单引号 '
	•	不使用分号 ;
	•	两空格缩进
	•	使用函数声明 function foo() {} 而不是函数表达式
	•	在复杂类型中使用 interface 替代 type
	•	所有函数均应带显式返回类型
	•	模块导出时优先使用命名导出

⸻

React Guidelines
	•	使用 useEffect 时，参考“You Might Not Need an Effect”
	•	每个文件仅包含一个组件
	•	使用 clsx 管理 className：

import { clsx } from 'clsx'


	•	避免属性钻取，使用 Jotai 创建 atom 状态
	•	为复杂交互组件添加合适的 ARIA 属性
	•	清理事件监听时使用 AbortController
	•	优先使用命名导出，默认导出仅限页面级组件

⸻

🧰 常用开发任务 | Common Development Tasks

🧠 添加新的AI模型提供商
	1.	创建文件：lib/llm/core/providers/<provider>.ts
	2.	实现接口：generate, streamGenerate
	3.	在 lib/llm/core/index.ts 注册
	4.	更新配置与前端UI

⸻

📄 添加新的文件格式支持
	1.	在 lib/file/file-process/ 创建新格式处理器
	2.	实现内容提取与文本转换逻辑
	3.	更新文件类型检测
	4.	添加对应UI组件

⸻

🧩 自定义Specs提示词模板
	1.	在 lib/llm/prompts/ 新建提示词文件
	2.	使用 i18n 支持多语言
	3.	在设置界面添加可配置项
	4.	测试不同模型表现

⸻

📦 添加新的导出格式
	1.	在 components/export/ 新建组件
	2.	实现数据格式转换逻辑
	3.	更新导出弹窗
	4.	添加验证与错误处理

⸻

✅ End of agent.md

⸻

是否希望我帮你将此文档转化为带有目录（TOC）与中英文标签的 Markdown 风格优化版（可直接发布到 GitHub README 或 Docsify）？
那样它会带有自动编号、锚点和中英分栏排版，更适合项目展示。