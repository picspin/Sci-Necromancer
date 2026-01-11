# Sci-Necromancer

AI-powered academic abstract generator for medical imaging and scientific research conferences.

**[English](README.md) | [中文](README_CN.md) | [Deutsch](README_DE.md)**

## Overview

Sci-Necromancer streamlines the process of preparing conference abstracts by leveraging large language models to analyze research content, generate impact statements, suggest appropriate submission categories, and produce polished abstracts that conform to conference guidelines.

> **Migration Status**: This project has been migrated from React 19 to **Vue 3 + Composition API** with a **Nest.js serverless backend** for file processing.

### Supported Conferences

- **ISMRM** - International Society for Magnetic Resonance in Medicine
- **RSNA** - Radiological Society of North America
- **ESC** - European Society of Cardiology
- **ECR** - European Congress of Radiology

## Features

### Abstract Generation

- **Standard Analysis Mode**: Upload PDF/DOCX or paste text, then follow a guided workflow:
  - Content analysis with keyword extraction
  - Impact statement and synopsis generation
  - Abstract type suggestion based on content
  - Final abstract generation conforming to conference guidelines
- **Creative Expansion Mode**: Provide a core research idea and generate a complete abstract directly

### Figure Generation

- **Standard Edit**: Upload images and apply AI-powered editing based on specifications
- **Creative Generation**: Generate figures from abstract context (impact + synopsis)

### Abstract Management

- Save and organize generated abstracts locally
- Import/export abstracts as JSON for backup and sharing
- Full CRUD operations on saved abstracts

### Export Options

- Markdown (.md)
- PDF document
- JSON data

### Internationalization

- English and Chinese language support
- Automatic browser language detection
- Easy language switching via UI

## Tech Stack

| Category         | Technologies                               |
| ---------------- | ------------------------------------------ |
| Frontend         | Vue 3 (Composition API, `<script setup>`)  |
| State Management | Pinia (with persisted state)               |
| Styling          | Tailwind CSS (JIT mode)                    |
| Build Tool       | Vite 6                                     |
| Backend          | Nest.js (Serverless Functions)             |
| AI Integration   | Google AI (Gemini), OpenAI-compatible APIs |
| File Processing  | pdf-parse, mammoth (DOCX), pdfjs-dist      |
| Testing          | Vitest, Vue Test Utils, Testing Library    |
| i18n             | vue-i18n                                   |
| Code Quality     | ESLint, Prettier, Husky, lint-staged       |

## Quick Start

### Prerequisites

- Node.js 18 or higher
- API key for Google AI (Gemini) or an OpenAI-compatible provider

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/sci-necromancer.git
cd sci-necromancer

# Install dependencies
npm install

# Start development server
npm run dev
```

The application will be available at `http://localhost:3000`.

### Production Build

```bash
npm run build
npm run preview
```

## Configuration

### First-Time Setup

1. Launch the application and click the **Models** button (gear icon) in the header
2. Select your AI provider:
   - **Google AI**: Enter your Gemini API key from [Google AI Studio](https://aistudio.google.com/)
   - **OpenAI-compatible**: Enter base URL and API key (supports OpenAI, SiliconFlow, and other compatible APIs)
3. Configure models (optional):
   - Text model (e.g., `gemini-2.5-pro`, `gpt-4o`)
   - Vision model (for image analysis)
   - Image model (for figure generation)
4. Save settings

Settings are stored in browser localStorage and persist across sessions.

### Supported Providers

| Provider    | Base URL                        | Notes                     |
| ----------- | ------------------------------- | ------------------------- |
| Google AI   | N/A                             | Uses `@google/genai` SDK  |
| OpenAI      | `https://api.openai.com/v1`     | Official OpenAI API       |
| SiliconFlow | `https://api.siliconflow.cn/v1` | Image generation support  |
| Custom      | Your endpoint URL               | Any OpenAI-compatible API |

## Usage

### Standard Analysis Workflow

1. **Select Conference**: Choose the target conference tab (ISMRM, RSNA, ESC, ECR)
2. **Input Content**: Upload a PDF/DOCX file or paste your research text
3. **Analyze**: Click "Analyze" to extract categories and keywords
4. **Generate Impact & Synopsis**: Create impact statement and synopsis
5. **Select Type**: Review AI-suggested abstract types or choose manually
6. **Generate Abstract**: Produce the final abstract conforming to conference guidelines
7. **Export**: Download as Markdown, PDF, or JSON

### Creative Expansion Mode

1. Select a conference and switch to "Creative Expansion" mode
2. Enter your core research idea or hypothesis
3. Generate a complete abstract directly from the concept

### Figure Generation

1. Navigate to the "Figure Generation" tab
2. Choose mode:
   - **Standard Edit**: Upload an image and specify editing instructions
   - **Creative Generation**: Generate figures based on your abstract context
3. Download the generated figure

## ECR (European Congress of Radiology) Features

### Research Type Guidelines (EQUATOR Network)

The ECR module integrates EQUATOR Network reporting guidelines to ensure your abstract follows best practices for your study type:

| Study Type                  | Checklist | Description                                                          |
| --------------------------- | --------- | -------------------------------------------------------------------- |
| Case-control study          | STROBE    | Strengthening the Reporting of Observational studies in Epidemiology |
| Cross-sectional study       | STROBE    | Strengthening the Reporting of Observational studies in Epidemiology |
| Diagnostic/prognostic study | STARD     | Standards for Reporting of Diagnostic Accuracy Studies               |
| Experimental (animal)       | ARRIVE    | Animal Research: Reporting of In Vivo Experiments                    |
| Observational study         | STROBE    | Strengthening the Reporting of Observational studies in Epidemiology |
| Randomised controlled trial | CONSORT   | Consolidated Standards of Reporting Trials                           |

For more information, visit the [EQUATOR Network](http://equator-network.org/).

### ECR Abstract Types

- **Research Presentation (RP)** - 5-minute oral presentation
- **Clinical Trials in Radiology (CTiR)** - 8-minute presentation for multicentre/randomised studies
- **EPOS Scientific Poster** - Electronic poster with scientific content
- **EPOS Educational Poster** - Teaching-focused electronic poster
- **Student Presentation** - For university projects and first research papers

### Submission Portal

**ECR Abstract Submission**: [www.myESR.org/abstractsubmission](https://www.myesr.org/abstractsubmission)

## Project Structure

```
sci-necromancer/
├── src/
│   ├── main.ts                 # Application entry point
│   ├── App.vue                 # Root component with error boundary
│   ├── components/
│   │   ├── panels/             # Conference-specific panels (ISMRM, RSNA, ESC, ECR)
│   │   │   ├── ConferencePanel.vue
│   │   │   ├── ISMRMPanel.vue
│   │   │   ├── RSNAPanel.vue
│   │   │   ├── ESCPanel.vue
│   │   │   ├── ERPanel.vue
│   │   │   └── ImageGenerationPanel/
│   │   ├── managers/           # Abstract and Model configuration
│   │   ├── ui/                 # Reusable UI components
│   │   └── export/             # Export functionality
│   ├── composables/            # Vue composables (useLLM, useSettings, etc.)
│   ├── plugins/                # Vue plugins (i18n, errorHandler)
│   └── services/               # Frontend services
├── lib/
│   ├── llm/                    # LLM provider integrations
│   │   ├── index.ts            # Unified API facade
│   │   ├── gemini.ts           # Google AI integration
│   │   ├── openai.ts           # OpenAI-compatible integration
│   │   └── prompts/            # Conference-specific prompts
│   ├── conference/             # Conference module system
│   │   ├── modules/            # Per-conference implementations
│   │   ├── BaseConferenceModule.ts
│   │   ├── ConferenceRegistry.ts
│   │   └── ConferenceRouter.ts
│   ├── file/                   # File processing utilities
│   ├── hooks/                  # Shared hooks (theme, keyboard nav)
│   ├── i18n/                   # Internationalization config
│   └── utils/                  # Shared utilities
├── server/                     # Nest.js serverless backend
│   └── src/
│       ├── main.ts             # Serverless entry point
│       ├── app.module.ts       # Root module
│       └── file/               # File processing module
│           ├── file.controller.ts
│           ├── file.service.ts
│           └── dto/
├── services/                   # Legacy services (being migrated)
├── public/
│   ├── locales/                # i18n translation files
│   └── *.md                    # Conference guidelines
├── types.ts                    # TypeScript type definitions
├── vite.config.ts              # Vite configuration
└── tsconfig.json               # TypeScript configuration
```

## Development

### Available Scripts

| Command                 | Description                    |
| ----------------------- | ------------------------------ |
| `npm run dev`           | Start development server       |
| `npm run build`         | Build for production           |
| `npm run preview`       | Preview production build       |
| `npm run lint`          | Run TypeScript type checking   |
| `npm run lint:fix`      | Fix ESLint issues              |
| `npm run format`        | Format code with Prettier      |
| `npm run test`          | Run tests with Vitest          |
| `npm run test:ui`       | Run tests with Vitest UI       |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run prepare`       | Setup Husky git hooks          |

### Backend Development

The Nest.js backend is located in the `server/` directory:

```bash
cd server
npm install
npm run start:dev
```

### Path Aliases

The `@` alias maps to the project root:

```typescript
import { useSettings } from '@/src/composables/useSettings';
import { analyzeContent } from '@/lib/llm';
```

### Adding a New Conference

1. Create a new module in `lib/conference/modules/` extending `BaseConferenceModule`
2. Define conference-specific guidelines, types, and prompts
3. Register the module in `ConferenceRegistry`
4. Create a corresponding panel component in `src/components/panels/`
5. Add translations in `public/locales/`

### Architecture Notes

- **State Management**: Uses Pinia stores with `pinia-plugin-persistedstate` for localStorage persistence
- **Error Handling**: Global error boundary via `onErrorCaptured` hook in `App.vue`
- **LLM Integration**: Unified facade in `lib/llm/index.ts` handles provider selection
- **File Processing**: Heavy parsing (PDF/DOCX) delegated to Nest.js backend, avoiding browser-side overhead

## Deployment

### Vercel (Recommended)

1. Push the repository to GitHub
2. Import the project in Vercel
3. Configure:
   - Framework preset: **Vite**
   - Build command: `npm run build`
   - Output directory: `dist`
4. For serverless backend, configure the `server/` directory as a separate Vercel Function
5. Deploy

No environment variables are required; API keys are entered via UI and stored locally.

### Serverless Backend Deployment

The Nest.js backend in `server/` supports deployment to:

- **Vercel Serverless Functions**
- **AWS Lambda** (via `@nestjs/platform-aws-lambda`)
- **Other serverless platforms** with appropriate adapters

### Other Platforms

The frontend build output is a static site in `dist/`. Deploy to any static hosting service (Netlify, GitHub Pages, Cloudflare Pages, etc.).

## Security

- API keys are stored in browser localStorage only
- No server-side storage or transmission of credentials
- File processing delegated to serverless backend (sandboxed execution)
- Avoid uploading sensitive or confidential research data

## MCP Tools Integration

Sci-Necromancer supports optional MCP (Model Context Protocol) integrations:

- **Supabase MCP**: Cloud persistence for abstracts and settings (configure via Model Manager)
- **Image Generation MCP**: Alternative image generation via MCP-enabled tools
- **Chrome DevTools MCP**: UI comparison during development

See `MCP_TOOLS_GUIDE.md` for detailed configuration.

## Troubleshooting

| Issue                  | Solution                                                            |
| ---------------------- | ------------------------------------------------------------------- |
| API errors             | Verify API key is correct and has sufficient quota                  |
| PDF parsing fails      | Try a smaller file or use the serverless backend                    |
| Port 3000 in use       | Vite auto-selects another port (check terminal output)              |
| Build type errors      | Run `npm run lint` to identify TypeScript issues                    |
| Backend not responding | Ensure Nest.js server is running (`cd server && npm run start:dev`) |

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Commit changes (`git commit -m 'Add your feature'`)
4. Push to branch (`git push origin feature/your-feature`)
5. Open a Pull Request

Please run `npm run lint` before submitting PRs to ensure type safety.

## Documentation

- `README.md` - This file (quick start and overview)
- `QUICK_REFERENCE.md` - Common user tasks and shortcuts
- `WORKFLOW.md` - Overall workflow documentation
- `MODEL_CONFIGURATION_GUIDE.md` - Provider setup details
- `MCP_TOOLS_GUIDE.md` - MCP integration guide
- `IMAGE_GENERATION_ARCHITECTURE.md` - Figure generation technical details
- `lib/llm/WRITING_STYLE_GUIDE.md` - Writing style enforcement guidance

## Acknowledgments

- [ISMRM](https://www.ismrm.org/), [RSNA](https://www.rsna.org/), [ESC](https://www.escardio.org/), [ESR](https://www.myesr.org/) for public abstract guidelines
- [Google AI](https://ai.google.dev/) (Gemini) for language model capabilities
- [OpenAI](https://openai.com/) for API compatibility standards
- [SiliconFlow](https://siliconflow.cn/) for image generation APIs
- [EQUATOR Network](http://equator-network.org/) for research reporting guidelines
- [Vue.js](https://vuejs.org/) and [Pinia](https://pinia.vuejs.org/) for the frontend framework
- [Nest.js](https://nestjs.com/) for the serverless backend framework

## License

MIT

---

**[English](README.md) | [中文](README_CN.md) | [Deutsch](README_DE.md)**
