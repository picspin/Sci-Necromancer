# Sci-Necromancer

AI驱动的医学影像和科学研究会议学术摘要生成器。

## 概述

Sci-Necromancer 通过利用大语言模型来简化会议摘要的准备过程，可以分析研究内容、生成影响力陈述、建议合适的投稿类别，并生成符合会议指南的精炼摘要。

### 支持的会议

- **ISMRM** - 国际医学磁共振学会
- **RSNA** - 北美放射学会
- **ESC** - 欧洲心脏病学会
- **ECR** - 欧洲放射学大会

## 功能特点

### 摘要生成

- **标准分析模式**：上传 PDF/DOCX 文件或粘贴文本，然后按照引导流程操作：
  - 内容分析与关键词提取
  - 影响力陈述和摘要生成
  - 根据内容建议摘要类型
  - 生成符合会议指南的最终摘要
- **创意扩展模式**：提供核心研究想法，直接生成完整摘要

### 图表生成

- **标准编辑**：上传图像并根据规格进行 AI 驱动的编辑
- **创意生成**：根据摘要上下文（影响力 + 摘要）生成图表

### 摘要管理

- 本地保存和整理生成的摘要
- 以 JSON 格式导入/导出摘要用于备份和分享
- 对已保存摘要进行完整的增删改查操作

### 导出选项

- Markdown (.md)
- PDF 文档
- JSON 数据

### 国际化

- 支持英语和中文
- 自动检测浏览器语言
- 通过界面轻松切换语言

## 技术栈

| 类别     | 技术                                    |
| -------- | --------------------------------------- |
| 前端     | Vue 3（组合式 API）、TypeScript         |
| 状态管理 | Pinia、Vue Composables                  |
| 样式     | Tailwind CSS                            |
| 构建工具 | Vite                                    |
| AI 集成  | Google AI（Gemini）、兼容 OpenAI 的 API |
| 文件处理 | pdf-parse、mammoth（DOCX）              |
| 测试     | Vitest                                  |

## 快速开始

### 前置要求

- Node.js 18 或更高版本
- Google AI（Gemini）或兼容 OpenAI 提供商的 API 密钥

### 安装

```bash
# 克隆仓库
git clone https://github.com/yourusername/sci-necromancer.git
cd sci-necromancer

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

应用将在 `http://localhost:3000` 上可用。

### 生产构建

```bash
npm run build
npm run preview
```

## 配置

### 首次设置

1. 启动应用并点击页眉中的**模型**按钮（齿轮图标）
2. 选择您的 AI 提供商：
   - **Google AI**：输入来自 [Google AI Studio](https://aistudio.google.com/) 的 Gemini API 密钥
   - **兼容 OpenAI**：输入基础 URL 和 API 密钥（支持 OpenAI、SiliconFlow 及其他兼容 API）
3. 配置模型（可选）：
   - 文本模型（如 `gemini-2.5-pro`、`gpt-4o`）
   - 视觉模型（用于图像分析）
   - 图像模型（用于图表生成）
4. 保存设置

设置存储在浏览器 localStorage 中，跨会话持久保存。

### 支持的提供商

| 提供商      | 基础 URL                        | 备注                     |
| ----------- | ------------------------------- | ------------------------ |
| Google AI   | 不适用                          | 使用 `@google/genai` SDK |
| OpenAI      | `https://api.openai.com/v1`     | 官方 OpenAI API          |
| SiliconFlow | `https://api.siliconflow.cn/v1` | 支持图像生成             |
| 自定义      | 您的端点 URL                    | 任何兼容 OpenAI 的 API   |

## 使用方法

### 标准分析工作流程

1. **选择会议**：选择目标会议标签（ISMRM、RSNA、ESC、ECR）
2. **输入内容**：上传 PDF/DOCX 文件或粘贴研究文本
3. **分析**：点击"分析"提取类别和关键词
4. **生成影响力和摘要**：创建影响力陈述和摘要
5. **选择类型**：查看 AI 建议的摘要类型或手动选择
6. **生成摘要**：生成符合会议指南的最终摘要
7. **导出**：下载为 Markdown、PDF 或 JSON

### 创意扩展模式

1. 选择会议并切换到"创意扩展"模式
2. 输入您的核心研究想法或假设
3. 直接从概念生成完整摘要

### 图表生成

1. 导航到"图表生成"标签
2. 选择模式：
   - **标准编辑**：上传图像并指定编辑指令
   - **创意生成**：根据摘要上下文生成图表
3. 下载生成的图表

## ECR（欧洲放射学大会）特别功能

### 研究类型指南（EQUATOR Network）

ECR 模块集成了 EQUATOR Network 研究报告指南：

| 研究类型         | 检查清单 | 说明                       |
| ---------------- | -------- | -------------------------- |
| 病例对照研究     | STROBE   | 流行病学观察性研究报告强化 |
| 横断面研究       | STROBE   | 流行病学观察性研究报告强化 |
| 诊断/预后研究    | STARD    | 诊断准确性研究报告标准     |
| 实验研究（动物） | ARRIVE   | 动物研究：体内实验报告     |
| 观察性研究       | STROBE   | 流行病学观察性研究报告强化 |
| 随机对照试验     | CONSORT  | 试验报告整合标准           |

### 投稿链接

- **ECR 摘要投稿门户**：[www.myESR.org/abstractsubmission](https://www.myesr.org/abstractsubmission)

## 项目结构

```
sci-necromancer/
├── src/
│   ├── main.ts                 # 应用入口
│   ├── App.vue                 # 根组件
│   ├── components/
│   │   ├── panels/             # 会议特定面板
│   │   ├── managers/           # 摘要和模型管理器
│   │   ├── ui/                 # 可复用 UI 组件
│   │   └── export/             # 导出功能
│   ├── composables/            # Vue composables（hooks）
│   └── plugins/                # Vue 插件（i18n 等）
├── lib/
│   ├── llm/                    # LLM 提供商集成
│   │   ├── index.ts            # 统一 API 门面
│   │   ├── gemini.ts           # Google AI 集成
│   │   └── openai.ts           # 兼容 OpenAI 集成
│   ├── conference/             # 会议模块系统
│   │   ├── modules/            # 各会议实现
│   │   ├── ConferenceRegistry.ts
│   │   └── ConferenceRouter.ts
│   ├── file/                   # 文件处理工具
│   └── utils/                  # 共享工具
├── public/
│   ├── locales/                # i18n 翻译文件
│   └── *.md                    # 会议指南
├── types.ts                    # TypeScript 类型定义
├── vite.config.ts              # Vite 配置
└── tsconfig.json               # TypeScript 配置
```

## 开发

### 可用脚本

| 命令               | 描述                     |
| ------------------ | ------------------------ |
| `npm run dev`      | 启动开发服务器           |
| `npm run build`    | 生产环境构建             |
| `npm run preview`  | 预览生产构建             |
| `npm run lint`     | 运行 TypeScript 类型检查 |
| `npm run lint:fix` | 修复 ESLint 问题         |
| `npm run format`   | 使用 Prettier 格式化代码 |
| `npm run test`     | 使用 Vitest 运行测试     |
| `npm run test:ui`  | 运行带 UI 的测试         |

### 路径别名

`@` 别名映射到项目根目录：

```typescript
import { useSettings } from '@/src/composables/useSettings';
import { analyzeContent } from '@/lib/llm';
```

### 添加新会议

1. 在 `lib/conference/modules/` 中创建新模块
2. 使用会议特定指南和类型扩展 `BaseConferenceModule`
3. 在 `ConferenceRegistry` 中注册模块
4. 在 `src/components/panels/` 中创建对应的面板组件
5. 在 `public/locales/` 中添加翻译

## 部署

### Vercel（推荐）

1. 将仓库推送到 GitHub
2. 在 Vercel 中导入项目
3. 配置：
   - 框架预设：**Vite**
   - 构建命令：`npm run build`
   - 输出目录：`dist`
4. 部署

无需环境变量；API 密钥通过 UI 输入并本地存储。

### 其他平台

构建输出是 `dist/` 中的静态站点。可部署到任何静态托管服务（Netlify、GitHub Pages、Cloudflare Pages 等）。

## 安全性

- API 密钥仅存储在浏览器 localStorage 中
- 无服务器端存储或凭据传输
- 文件处理完全在浏览器中运行
- 避免上传敏感或机密研究数据

## 故障排除

| 问题             | 解决方案                                 |
| ---------------- | ---------------------------------------- |
| API 错误         | 验证 API 密钥正确且有足够配额            |
| PDF 解析失败     | 尝试更小的文件或直接粘贴文本             |
| 端口 3000 被占用 | Vite 自动选择其他端口（查看终端输出）    |
| 构建类型错误     | 运行 `npm run lint` 识别 TypeScript 问题 |

## 贡献

1. Fork 仓库
2. 创建功能分支（`git checkout -b feature/your-feature`）
3. 提交更改（`git commit -m 'Add your feature'`）
4. 推送到分支（`git push origin feature/your-feature`）
5. 创建 Pull Request

## 致谢

- [ISMRM](https://www.ismrm.org/)、[RSNA](https://www.rsna.org/)、[ESC](https://www.escardio.org/)、[ESR](https://www.myesr.org/) 提供的公开摘要指南
- [Google AI](https://ai.google.dev/)（Gemini）提供的语言模型能力
- [OpenAI](https://openai.com/) 提供的 API 兼容标准
- [SiliconFlow](https://siliconflow.cn/) 提供的图像生成 API
- [EQUATOR Network](http://equator-network.org/) 提供的研究报告指南

---

[English](README.md) | **中文** | [Deutsch](README_DE.md)
