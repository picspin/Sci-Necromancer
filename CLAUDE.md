# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common commands

Project uses Vite + TypeScript + React.

- Install dependencies:
  - npm install
- Run dev server (opens on http://localhost:3000 per vite.config.ts:27-29):
  - npm run dev
- Build:
  - npm run build (tsc then vite build)
- Preview production build:
  - npm run preview
- Type lint (TypeScript only; no ESLint configured):
  - npm run lint

Notes:

- No test framework is present (no jest/vitest config, no test scripts). To smoke-test a single component/page, run the dev server and navigate to UI paths.
- Path alias @ maps to project root (vite.config.ts:9-12, tsconfig.json:24-27).

## Key configuration files

- package.json scripts: root package.json:6-11
- Vite config: vite.config.ts:6-33 (plugins, alias @, dev server port 3000, manual chunks)
- TypeScript config: tsconfig.json:2-31 (strict, bundler moduleResolution, baseUrl, paths)

## High-level architecture

- React application entry and layout:
  - App.tsx:19-106 wraps UI in ErrorBoundary, SettingsProvider, AbstractProvider; renders ConferencePanel, modals for AbstractManager and ModelManager, NotificationDisplay.
- State management via React Context:
  - context/SettingsContext.tsx:14-29 defines default settings (provider, API keys, model, MCP config) and persists to localStorage. Exposes updateSettings/saveSettings and a LocalStorageService for persistence.
  - context/AbstractContext.tsx provides abstract workflow state (import as needed when working on panels).
- LLM integration layer:
  - lib/llm/index.ts:19-30 selects provider ('google' vs 'openai') from localStorage and delegates to lib/llm/gemini.ts or lib/llm/openai.ts. Exposes analyzeContent, generateImpactSynopsis, generateFinalAbstract, generateCreativeAbstract, generateImage, plus conference-specific helpers (lines 88-117, 99-107).
  - lib/llm/openai.ts implements OpenAI-compatible calls to chat/completions and SiliconFlow image generation (and optional MCP image generation path). It reads settings (base URL, models) from localStorage.
  - lib/llm/gemini.ts integrates Google AI (Gemini) for text workflows.
- Conference module system and routing:
  - lib/conference/ defines modules per conference (ISMRM, RSNA, JACC, ER) with guidelines/types; ConferenceRegistry and ConferenceRouter manage available modules and active selection.
  - lib/hooks/useConferenceRegistry.ts:9-53 initializes registry and syncs active conference; provides switchConference.
  - components/ConferencePanel.tsx:21-85 renders tabs and loads respective panels.
- Panels for workflows:
  - components/ISMRMPanel.tsx, RSNAPanel.tsx, JACCPanel.tsx implement analysis, type selection, abstract generation, and figure generation flows using lib/llm.
- File processing utilities:
  - lib/file/FileProcessingService.ts and lib/file/file-process/{pdf.ts, docx.ts} handle extracting text from uploads.
- Notifications:
  - lib/utils/notificationService.ts:12-81 provides a pub/sub notification service; components/NotificationDisplay.tsx renders toasts.
- Internationalization:
  - lib/i18n/\* and components/I18nProvider.tsx integrate i18next and translations.
- Optional MCP tools & cloud persistence:
  - components/SupabaseMCPConfig.tsx configures Supabase MCP; services/databaseFallbackService.ts manages local-first storage with optional cloud sync via a pluggable DatabaseService.
  - ModelManager (components/ModelManager.tsx) configures provider keys, base URLs, models, and MCP tool toggles.

## Provider configuration & environment

- Settings persisted in localStorage key 'app-settings' (context/SettingsContext.tsx:42-58). Includes:
  - provider: 'google' or 'openai'
  - googleApiKey, openAIApiKey, openAIBaseUrl
  - openAITextModel, openAIVisionModel, openAIImageModel
  - databaseEnabled and mcpConfig (supabase/imageGeneration)
- No .env is used; keys are entered via UI and stored locally.

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

- **Context Limit**: 200K tokens (mga-claude-sonnet-4.5)
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
