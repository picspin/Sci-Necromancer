# Sci-Necromancer (Vue Edition)

AI-powered academic abstract generation for medical imaging research, implemented with Vue 3 + TypeScript.

This Vue app provides multi-conference abstract workflows (ISMRM, RSNA, JACC, ER), figure generation, local persistence, and internationalization. It adapts the UI/UX and feature set from the React main branch while conforming to Vue architecture.

## Features

- Abstract workflows for ISMRM, RSNA, JACC, ER
- Content analysis → impact & synopsis → type suggestion → final abstract
- Figure generation: Standard (upload + edit) and Creative (from abstract context)
- Providers: Google AI (Gemini) and OpenAI-compatible APIs (incl. SiliconFlow)
- Local persistence with an Abstract Manager (import/export JSON)
- Internationalization (English, Chinese) with Vue I18n and i18next
- Accessibility-conscious UI: keyboard focus, screen reader utilities
- Exports: Markdown, PDF, JSON

## Tech Stack

- Frontend: Vue 3 (Composition API), TypeScript
- State: Pinia + Vue composables
- Styling: Tailwind CSS (CDN in index.html) + theme utilities
- Build: Vite
- AI: @google/genai (Gemini), OpenAI-compatible REST
- File processing: pdf-parse, mammoth/docx

## Project Structure

- src/
  - main.ts: Vue app entry and plugin setup
  - App.vue: Layout, header, modals (AbstractManager, ModelManager), notifications
  - components/panels/: ConferencePanel.vue + per-conference panels
  - components/ui/: common UI components (Modal, SvgIcon, NotificationDisplay, etc.)
  - components/managers/: AbstractManager.vue, ModelManager.vue
  - components/export/: ExportButtons.vue
  - composables/: useSettings.ts, useAbstract.ts, useNotifications.ts, useConferenceRegistry.ts
  - plugins/: i18n.ts, errorHandler.ts
- lib/
  - llm/: provider integrations (gemini.ts, openai.ts), index.ts facade
  - file/: FileProcessingService.ts, file-process/{pdf.ts, docx.ts}
  - utils/: notificationService.ts, retryUtils.ts, errorLogger.ts
  - conference/: BaseConferenceModule.ts and registry/router
- public/
  - Static guideline markdowns and locales
- vite.config.ts: Vue plugin, alias, manual chunks, dev server config
- tsconfig.json: TypeScript options

## Quick Start

Prerequisites

- Node.js 18+
- API key for Google AI (Gemini) or an OpenAI-compatible provider

Install and run

- npm install
- npm run dev
- The server attempts port 3000; if taken, Vite will use 3001 or another port

Production build

- npm run build
- npm run preview

## First-Time Setup (Model Manager)

- Click the gear icon in App header to open Model Manager
- Choose provider:
  - Google AI: enter your Gemini API key (from Google AI Studio)
  - OpenAI-compatible: enter base URL and API key (e.g., https://api.openai.com/v1 or SiliconFlow)
- Optionally set models:
  - Text model (e.g., gemini-2.5-pro or gpt-4o)
  - Vision model (for analyzing uploaded images)
  - Image model (for image generation; SiliconFlow defaults provided)
- Save settings (stored safely in localStorage on this device)

## Usage

ISMRM/RSNA/JACC workflows

- Standard mode: upload PDF/DOCX or paste text, then Analyze → Impact/Synopsis → Type Suggestion → Generate
- Creative mode: provide a core idea; system generates an abstract directly
- Save abstracts to Abstract Manager for later use; import/export via JSON

Figure generation

- Standard: upload image, specify editing instructions (specs), and generate
- Creative: generate figure from the context (impact + synopsis) of your abstract

Exports

- Use ExportButtons to download Abstract as Markdown, PDF, or JSON

## Internationalization

- Vue I18n provides runtime locale handling (Composition API mode)
- i18next + language detector synchronize locale (resources in public/locales)
- LanguageSelector component toggles languages

## Persistence & MCP

- Local-only by default (as requested)
- AbstractManager uses a local DatabaseService (LocalStorage)
- Optional MCP image generation wiring exists in code but remains disabled if not configured

## Development Notes

- Dev server: configured to open on port 3000 (vite.config.ts); Vite will auto-select another port if busy
- Path alias: '@' maps to project root; '@/components', '@/composables', '@/plugins' mapped in Vite resolve.alias
- Build chunks: manualChunks split vue-vendor, ai-vendor, pdf-vendor
- Type checking: The build script uses only Vite build; type lint via `npm run lint` (tsc --noEmit)

## Testing & Debugging

Functional checklist (dev server)

- App header: Model Manager opens, Abstract Manager opens
- i18n: Language toggles update UI
- ISMRM/RSNA/JACC panels:
  - File upload and parsing: PDF/DOCX text extraction populates input
  - Analyze → Impact/Synopsis → Type Suggestion → Generate flows
  - Creative mode generation
  - Export buttons: MD/PDF/JSON downloads
- Figure generation: Standard (upload + preview), Creative (requires generated abstract)
- Notifications: appear and auto-dismiss

Troubleshooting

- Missing API key: provider calls will error with clear messages in UI/console
- PDF/DOCX parsing: very large files may need manual text paste
- Port conflicts: Vite switches to a free port and logs the chosen URL

## Deployment (Vercel)

- This is a static Vite build; Vercel auto-detects
- Steps:
  - Push this repo to GitHub
  - In Vercel, "New Project" → import repo
  - Framework preset: Vite
  - Build command: `npm run build`
  - Output directory: `dist`
  - Environment variables: none required (keys entered via UI and stored locally)
- After deploy:
  - Open the app
  - Configure provider keys in Model Manager

## Security Considerations

- No server-side storage of keys; keys persist in localStorage
- Avoid uploading sensitive data; parsing runs in-browser
- Error logs and feedback are privacy-filtered and stored locally

## Migration Parity with React Main Branch

This Vue app matches the main-branch feature set and UI/UX:

- Conference workflows and guidelines
- Provider switching and model configuration
- File parsing and export options
- Figure generation modes
- Abstract Manager with import/export
- i18n and accessibility utilities

Remaining differences

- Internals use Vue composables/Pinia instead of React Context/Jotai
- Build/test scripts reflect Vue tooling

## Commands

- npm install
- npm run dev
- npm run build
- npm run preview
- npm run lint

## Acknowledgments

- ISMRM, RSNA, JACC for public abstract guidelines
- Google AI (Gemini) and OpenAI-compatible providers
- SiliconFlow for image generation APIs
