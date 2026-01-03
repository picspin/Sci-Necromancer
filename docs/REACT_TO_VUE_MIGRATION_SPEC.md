# React to Vue.js Migration Specification

## Sci-Necromancer Frontend Framework Migration

**Version:** 1.0
**Date:** 2025-12-11
**Status:** Planning Phase

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Migration Objectives](#migration-objectives)
3. [Architecture Overview](#architecture-overview)
4. [Agent Routing Table](#agent-routing-table)
5. [Technology Stack Mapping](#technology-stack-mapping)
6. [Component Migration Map](#component-migration-map)
7. [State Management Migration](#state-management-migration)
8. [Routing Strategy](#routing-strategy)
9. [File Structure](#file-structure)
10. [Migration Phases](#migration-phases)
11. [Feature Parity Checklist](#feature-parity-checklist)
12. [UI/UX Consistency Guidelines](#uiux-consistency-guidelines)
13. [Testing Strategy](#testing-strategy)

---

## 1. Executive Summary

This document specifies the complete migration of **Sci-Necromancer** from React 19 to Vue.js 3 (Composition API). The migration will maintain 100% feature parity, preserve all UI/UX characteristics, and improve maintainability through Vue's reactive system.

**Key Requirements:**

- Zero feature loss
- Identical UI/UX experience
- Maintain all LLM integrations (Google AI, OpenAI)
- Preserve MCP tools functionality
- Keep internationalization (i18n) support
- Maintain conference module system (ISMRM, RSNA, JACC, ER)

---

## 2. Migration Objectives

### Primary Goals

1. **Framework Replacement**: Replace React with Vue 3 Composition API
2. **Feature Preservation**: Maintain all existing functionality
3. **UI/UX Consistency**: Preserve exact look, feel, and user interactions
4. **Performance Improvement**: Leverage Vue's reactive system for better performance
5. **Code Quality**: Improve maintainability through Vue's single-file components

### Success Criteria

- All 22 React components successfully migrated to Vue
- All tests passing (unit, integration, E2E)
- Identical visual appearance (pixel-perfect where critical)
- Same user workflows and interactions
- No breaking changes to localStorage or data structures

---

## 3. Architecture Overview

### Current React Architecture

```
React App
├── App.tsx (Root)
├── Context Providers (Settings, Abstract)
├── Error Boundary
├── Components (22 total)
│   ├── Layout (Header, Footer)
│   ├── Panels (Conference-specific)
│   ├── Managers (Abstract, Model)
│   └── UI Components
├── Services (LLM, File, Database)
└── Utilities (i18n, notifications)
```

### Target Vue Architecture

```
Vue App
├── App.vue (Root)
├── Composables (useSettings, useAbstract)
├── Error Handler Plugin
├── Components (22 .vue files)
│   ├── Layout
│   ├── Panels
│   ├── Managers
│   └── UI Components
├── Services (Unchanged - Pure TS)
└── Utilities (Unchanged - Pure TS)
```

---

## 4. Agent Routing Table

To save context and work efficiently, the migration is divided into specialized agent responsibilities. Each agent handles a specific domain with clear boundaries.

### Agent Routing Table

| Agent ID      | Responsibility Domain       | Input Context                                             | Output Artifacts                                          | Dependencies         |
| ------------- | --------------------------- | --------------------------------------------------------- | --------------------------------------------------------- | -------------------- |
| **AGENT-001** | **Core Setup**              | package.json, vite.config.ts, tsconfig.json               | Vue project config, Vite Vue plugin, main.ts              | None                 |
| **AGENT-002** | **State Management**        | context/SettingsContext.tsx, context/AbstractContext.tsx  | composables/useSettings.ts, composables/useAbstract.ts    | AGENT-001            |
| **AGENT-003** | **Layout Components**       | App.tsx, components/Header.tsx                            | App.vue, components/Header.vue                            | AGENT-001, AGENT-002 |
| **AGENT-004** | **UI Base Components**      | Modal.tsx, SvgIcon.tsx, Tooltip.tsx, etc.                 | Equivalent .vue files                                     | AGENT-001            |
| **AGENT-005** | **Conference Panel System** | ConferencePanel.tsx, lib/hooks/useConferenceRegistry.ts   | ConferencePanel.vue, composables/useConferenceRegistry.ts | AGENT-002, AGENT-004 |
| **AGENT-006** | **ISMRM Panel**             | ISMRMPanel.tsx, lib/conference/modules/ISMRM/\*           | ISMRMPanel.vue                                            | AGENT-005            |
| **AGENT-007** | **RSNA Panel**              | RSNAPanel.tsx, lib/conference/modules/RSNA/\*             | RSNAPanel.vue                                             | AGENT-005            |
| **AGENT-008** | **JACC Panel**              | JACCPanel.tsx, lib/conference/modules/JACC/\*             | JACCPanel.vue                                             | AGENT-005            |
| **AGENT-009** | **Managers**                | AbstractManager.tsx, ModelManager.tsx                     | AbstractManager.vue, ModelManager.vue                     | AGENT-002, AGENT-004 |
| **AGENT-010** | **Notification System**     | NotificationDisplay.tsx, lib/utils/notificationService.ts | NotificationDisplay.vue, useNotifications.ts              | AGENT-001            |
| **AGENT-011** | **i18n Integration**        | components/I18nProvider.tsx, lib/i18n/\*                  | i18n plugin integration                                   | AGENT-001            |
| **AGENT-012** | **Error Handling**          | components/error/ErrorBoundary.tsx                        | Error handler plugin                                      | AGENT-001            |
| **AGENT-013** | **Testing Setup**           | vitest.setup.ts, existing tests                           | Vue test utils config, migrated tests                     | All agents           |
| **AGENT-014** | **Integration Testing**     | N/A                                                       | E2E tests, integration tests                              | All agents           |
| **AGENT-015** | **QA & Validation**         | All migrated files                                        | Validation report, feature parity checklist               | All agents           |

### Agent Context Management Strategy

Each agent will:

1. **Receive**: Minimal context (only relevant files)
2. **Reference**: This spec document (read-only)
3. **Produce**: Specified artifacts with clear interfaces
4. **Communicate**: Via shared state (committed files)
5. **Validate**: Against feature parity checklist before handoff

### Sequential Execution Order

```
Phase 1: Foundation
AGENT-001 → AGENT-002 → AGENT-011 → AGENT-012

Phase 2: Base Components
AGENT-003 → AGENT-004 → AGENT-010

Phase 3: Conference System
AGENT-005 → AGENT-006 → AGENT-007 → AGENT-008

Phase 4: Complex Features
AGENT-009

Phase 5: Testing & QA
AGENT-013 → AGENT-014 → AGENT-015
```

---

## 5. Technology Stack Mapping

### Dependencies Changes

| Category             | React Stack                    | Vue Stack                  | Notes                 |
| -------------------- | ------------------------------ | -------------------------- | --------------------- |
| **Core Framework**   | react@19.2.0, react-dom@19.2.0 | vue@3.5.13                 | Vue 3 Composition API |
| **Build Tool**       | @vitejs/plugin-react@5.0.0     | @vitejs/plugin-vue@5.2.1   | Already using Vite    |
| **TypeScript**       | (existing)                     | (keep)                     | No changes            |
| **State Management** | React Context + hooks          | Pinia@2.3.0 or Composables | Prefer composables    |
| **Routing**          | (none - tabs)                  | (none - tabs)              | No router needed      |
| **i18n**             | react-i18next@16.2.1           | vue-i18n@10.0.9            | Same i18next core     |
| **Testing**          | @testing-library/react@16.3.0  | @vue/test-utils@2.4.6      | Vitest compatible     |
| **Icons/SVG**        | Custom SvgIcon component       | Same approach              | Keep logic            |

### Install Commands

```bash
# Remove React
npm uninstall react react-dom @types/react @types/react-dom react-i18next @vitejs/plugin-react @testing-library/react

# Install Vue
npm install vue@3.5.13
npm install -D @vitejs/plugin-vue @vue/test-utils vue-i18n @vue/tsconfig @types/node
```

---

## 6. Component Migration Map

### Complete Component List (22 Components)

| #   | React Component           | Vue Component             | Complexity | Agent     | Dependencies          |
| --- | ------------------------- | ------------------------- | ---------- | --------- | --------------------- |
| 1   | App.tsx                   | App.vue                   | High       | AGENT-003 | All providers         |
| 2   | Header.tsx                | Header.vue                | Low        | AGENT-003 | -                     |
| 3   | ConferencePanel.tsx       | ConferencePanel.vue       | High       | AGENT-005 | useConferenceRegistry |
| 4   | ISMRMPanel.tsx            | ISMRMPanel.vue            | High       | AGENT-006 | LLM services          |
| 5   | RSNAPanel.tsx             | RSNAPanel.vue             | High       | AGENT-007 | LLM services          |
| 6   | JACCPanel.tsx             | JACCPanel.vue             | High       | AGENT-008 | LLM services          |
| 7   | AbstractManager.tsx       | AbstractManager.vue       | High       | AGENT-009 | Database services     |
| 8   | ModelManager.tsx          | ModelManager.vue          | High       | AGENT-009 | Settings              |
| 9   | Modal.tsx                 | Modal.vue                 | Medium     | AGENT-004 | -                     |
| 10  | SvgIcon.tsx               | SvgIcon.vue               | Low        | AGENT-004 | -                     |
| 11  | NotificationDisplay.tsx   | NotificationDisplay.vue   | Medium     | AGENT-010 | notificationService   |
| 12  | LanguageSelector.tsx      | LanguageSelector.vue      | Low        | AGENT-011 | i18n                  |
| 13  | I18nProvider.tsx          | i18n plugin               | Medium     | AGENT-011 | -                     |
| 14  | Tooltip.tsx               | Tooltip.vue               | Low        | AGENT-004 | -                     |
| 15  | AccessibleButton.tsx      | AccessibleButton.vue      | Low        | AGENT-004 | -                     |
| 16  | LiveRegion.tsx            | LiveRegion.vue            | Low        | AGENT-004 | -                     |
| 17  | ContextualHelp.tsx        | ContextualHelp.vue        | Low        | AGENT-004 | -                     |
| 18  | HelpDocumentation.tsx     | HelpDocumentation.vue     | Low        | AGENT-004 | -                     |
| 19  | AccessibilitySettings.tsx | AccessibilitySettings.vue | Medium     | AGENT-004 | -                     |
| 20  | ApiKeyNotification.tsx    | ApiKeyNotification.vue    | Low        | AGENT-010 | -                     |
| 21  | SupabaseMCPConfig.tsx     | SupabaseMCPConfig.vue     | Medium     | AGENT-009 | Settings              |
| 22  | ImageGenerationTest.tsx   | ImageGenerationTest.vue   | Medium     | AGENT-006 | LLM services          |

---

## 7. State Management Migration

### React Context → Vue Composables

#### SettingsContext.tsx → useSettings.ts

**React Pattern:**

```typescript
// context/SettingsContext.tsx
const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) throw new Error('useSettings must be used within SettingsProvider');
  return context;
};
```

**Vue Pattern:**

```typescript
// composables/useSettings.ts
import { ref, computed } from 'vue';
import type { Settings } from '@/types';

const settings = ref<Settings>(loadSettingsFromLocalStorage());

export function useSettings() {
  const updateSettings = (updates: Partial<Settings>) => {
    settings.value = { ...settings.value, ...updates };
    saveToLocalStorage(settings.value);
  };

  return {
    settings: computed(() => settings.value),
    updateSettings,
    saveSettings: (newSettings: Settings) => {
      settings.value = newSettings;
      saveToLocalStorage(newSettings);
    },
  };
}
```

**Key Differences:**

- No Provider wrapper needed in Vue
- Use `ref()` for reactive state
- Use `computed()` for derived state
- Direct function exports instead of context

#### AbstractContext.tsx → useAbstract.ts

**Migration Strategy:**

- Convert React useState/useReducer → Vue ref/reactive
- Convert useEffect → watchEffect/watch
- Keep business logic unchanged

---

## 8. Routing Strategy

### Current: Tab-based Navigation (Preserve)

No Vue Router needed. Conference switching is handled by:

1. Local component state (`activeConference`)
2. Conditional rendering (`v-if` instead of `&&`)

**React:**

```tsx
{
  activeConference === 'ISMRM' && <ISMRMPanel />;
}
{
  activeConference === 'RSNA' && <RSNAPanel />;
}
```

**Vue:**

```vue
<ISMRMPanel v-if="activeConference === 'ISMRM'" />
<RSNAPanel v-if="activeConference === 'RSNA'" />
```

---

## 9. File Structure

### New Vue Project Structure

```
Sci-Necromancer-Vue/
├── src/
│   ├── main.ts                    # Vue app entry (new)
│   ├── App.vue                    # Root component
│   ├── components/                # .vue components
│   │   ├── layout/
│   │   │   └── Header.vue
│   │   ├── panels/
│   │   │   ├── ConferencePanel.vue
│   │   │   ├── ISMRMPanel.vue
│   │   │   ├── RSNAPanel.vue
│   │   │   └── JACCPanel.vue
│   │   ├── managers/
│   │   │   ├── AbstractManager.vue
│   │   │   └── ModelManager.vue
│   │   ├── ui/
│   │   │   ├── Modal.vue
│   │   │   ├── SvgIcon.vue
│   │   │   ├── Tooltip.vue
│   │   │   └── NotificationDisplay.vue
│   │   └── error/
│   │       └── ErrorHandler.vue
│   ├── composables/               # Vue composables (new)
│   │   ├── useSettings.ts
│   │   ├── useAbstract.ts
│   │   ├── useConferenceRegistry.ts
│   │   └── useNotifications.ts
│   ├── lib/                       # Services (unchanged)
│   │   ├── llm/
│   │   ├── file/
│   │   ├── conference/
│   │   ├── i18n/
│   │   └── utils/
│   ├── services/                  # Business logic (unchanged)
│   ├── types.ts                   # TypeScript types (unchanged)
│   ├── plugins/                   # Vue plugins (new)
│   │   ├── i18n.ts
│   │   └── errorHandler.ts
│   └── assets/                    # Static assets
├── public/                        # Public files (unchanged)
├── docs/                          # Documentation
├── vite.config.ts                 # Updated for Vue
├── tsconfig.json                  # Updated paths
├── vitest.config.ts               # Updated for Vue testing
└── package.json                   # Updated dependencies
```

---

## 10. Migration Phases

### Phase 1: Foundation (AGENTS 001-002, 011-012)

**Duration:** ~2 hours
**Tasks:**

- Install Vue dependencies
- Configure Vite for Vue
- Create main.ts entry point
- Migrate SettingsContext → useSettings
- Migrate AbstractContext → useAbstract
- Set up i18n plugin
- Set up error handler

**Validation:**

- Vue dev server runs
- Type checking passes
- No build errors

### Phase 2: Base Components (AGENTS 003-004, 010)

**Duration:** ~3 hours
**Tasks:**

- Migrate App.tsx → App.vue
- Migrate Header → Header.vue
- Migrate all UI components (Modal, SvgIcon, Tooltip, etc.)
- Migrate NotificationDisplay
- Test component rendering

**Validation:**

- App shell loads
- Header displays correctly
- Modals open/close
- Notifications show

### Phase 3: Conference System (AGENTS 005-008)

**Duration:** ~5 hours
**Tasks:**

- Migrate ConferencePanel
- Migrate useConferenceRegistry hook
- Migrate ISMRMPanel
- Migrate RSNAPanel
- Migrate JACCPanel
- Test conference switching

**Validation:**

- All conference tabs work
- Panel switching is smooth
- Conference-specific colors apply
- Submission links work

### Phase 4: Complex Features (AGENT-009)

**Duration:** ~3 hours
**Tasks:**

- Migrate AbstractManager
- Migrate ModelManager
- Migrate SupabaseMCPConfig
- Test database operations
- Test settings persistence

**Validation:**

- Abstract saving/loading works
- Model configuration works
- MCP tools toggle correctly
- LocalStorage persistence works

### Phase 5: Testing & QA (AGENTS 013-015)

**Duration:** ~4 hours
**Tasks:**

- Set up Vue test utils
- Migrate all tests
- Write integration tests
- Perform QA checks
- Generate validation report

**Validation:**

- All tests pass
- 100% feature parity confirmed
- UI/UX consistency verified
- Performance benchmarks met

**Total Estimated Duration:** ~17 hours

---

## 11. Feature Parity Checklist

### Core Features

- [ ] Multi-provider LLM support (Google AI, OpenAI)
- [ ] Conference modules (ISMRM, RSNA, JACC, ER)
- [ ] Abstract generation workflow
  - [ ] Content analysis
  - [ ] Category extraction
  - [ ] Keyword extraction
  - [ ] Impact/synopsis generation
  - [ ] Final abstract generation
- [ ] Figure generation (SiliconFlow, MCP)
- [ ] Export functionality (Markdown, PDF, JSON)

### Settings & Configuration

- [ ] Model Manager
  - [ ] Provider selection
  - [ ] API key configuration
  - [ ] Base URL configuration
  - [ ] Model selection (text, vision, image)
  - [ ] Temperature/maxTokens settings
- [ ] MCP Tools
  - [ ] Supabase configuration
  - [ ] Image generation tools
  - [ ] Connection testing
- [ ] Internationalization (i18n)
  - [ ] Language selector
  - [ ] English translations
  - [ ] Chinese translations
  - [ ] Language detection

### UI Components

- [ ] Header with navigation
- [ ] Conference tabs
- [ ] Panel content areas
- [ ] Modals (Abstract Manager, Model Manager)
- [ ] Notifications/toasts
- [ ] Tooltips
- [ ] Buttons with icons
- [ ] Form inputs
- [ ] File upload
- [ ] Loading states
- [ ] Error states

### Data Persistence

- [ ] LocalStorage for settings
- [ ] LocalStorage for abstracts (local-first)
- [ ] Optional Supabase sync
- [ ] Import/export functionality

### Accessibility

- [ ] Keyboard navigation
- [ ] Screen reader support (ARIA labels)
- [ ] Focus management
- [ ] Live regions for dynamic content
- [ ] Accessible buttons
- [ ] Color contrast compliance

### Visual Design

- [ ] Color scheme matches exactly
- [ ] Spacing/padding identical
- [ ] Typography matches
- [ ] Animation timing same
- [ ] Responsive layout preserved
- [ ] Conference-specific colors apply

---

## 12. UI/UX Consistency Guidelines

### Design Tokens (Tailwind CSS)

Preserve all Tailwind classes exactly. Current theme:

```css
/* Base Colors */
--color-base-100: #1e1e2e; /* Background */
--color-base-200: #2a2a3e; /* Card background */
--color-base-300: #3a3a4e; /* Hover state */

--color-text-primary: #e0e0e0;
--color-text-secondary: #a0a0b0;

--color-brand-primary: #7c3aed; /* Purple */
--color-brand-secondary: #3b82f6;

/* Conference Colors */
--ismrm-primary: #2563eb;
--rsna-primary: #dc2626;
--jacc-primary: #16a34a;
--er-primary: #ea580c;
```

### Component Sizing

- Header height: `py-4` (1rem top/bottom padding)
- Button padding: `px-4 py-2`
- Modal max-width: `max-w-4xl`
- Card padding: `p-6`
- Gap between elements: `gap-4` (1rem)

### Animations

- Transition duration: `transition-all duration-200`
- Hover scale: `hover:scale-105`
- Loading spinner: `animate-spin`

### Typography

- Heading 1: `text-2xl font-bold`
- Heading 2: `text-xl font-semibold`
- Body text: `text-base`
- Small text: `text-sm`
- Font family: Default system fonts

### Interactive States

- **Hover**: Background lightens, text color brightens
- **Active**: Border/underline appears
- **Disabled**: `opacity-50 cursor-not-allowed`
- **Focus**: `focus:outline-none focus:ring-2 focus:ring-offset-2`

### Layout Patterns

- Max content width: `max-w-7xl mx-auto`
- Section spacing: `py-8`
- Horizontal padding: `px-6`

---

## 13. Testing Strategy

### Unit Tests

Each Vue component will have a corresponding test file:

```
components/
├── Modal.vue
└── __tests__/
    └── Modal.spec.ts
```

**Test Coverage Requirements:**

- Component rendering
- Props validation
- Event emission
- User interactions (clicks, inputs)
- Conditional rendering
- Composable logic

### Integration Tests

**Scenarios:**

1. Complete abstract generation workflow
2. Conference switching
3. Settings persistence
4. Abstract save/load
5. MCP tool configuration
6. Image generation

### E2E Tests (Vitest + Playwright)

**Critical User Flows:**

1. First-time setup → Configure API key → Generate abstract
2. Switch conferences → Verify panel changes
3. Generate figure → Verify image display
4. Export abstract → Verify file download
5. Change language → Verify UI updates

### Performance Tests

**Metrics:**

- Initial load time < 2s
- Conference switch < 100ms
- Abstract generation response time (depends on API)
- Memory usage stable (no leaks)

### Visual Regression Tests

Use Playwright screenshots to compare:

- Header layout
- Conference tabs
- Panel content
- Modal overlays
- Notification toasts

---

## Migration Execution Checklist

### Pre-Migration

- [ ] Backup current React codebase (Git tag: `react-v1.0`)
- [ ] Document current functionality (video recording)
- [ ] Create migration branch: `feature/vue-migration`
- [ ] Review this spec with all agents

### During Migration

- [ ] Execute agents sequentially (001 → 015)
- [ ] Commit after each agent completes
- [ ] Run tests after each phase
- [ ] Update progress in this document

### Post-Migration

- [ ] Full regression testing
- [ ] Performance benchmarking
- [ ] Accessibility audit
- [ ] Documentation updates
- [ ] Create PR for review
- [ ] Merge to main after approval

---

## Risk Mitigation

### Risks & Mitigation Strategies

| Risk                       | Impact | Likelihood | Mitigation                          |
| -------------------------- | ------ | ---------- | ----------------------------------- |
| Breaking API compatibility | High   | Low        | Keep all service layers unchanged   |
| Lost functionality         | High   | Medium     | Feature parity checklist validation |
| UI inconsistencies         | Medium | Medium     | Visual regression tests             |
| Performance regression     | Medium | Low        | Performance benchmarks              |
| Test coverage gaps         | Medium | Medium     | Mandatory test writing per agent    |
| Agent context overflow     | Low    | High       | Clear agent boundaries and routing  |

---

## Success Metrics

### Quantitative

- ✅ 100% components migrated
- ✅ 100% tests passing
- ✅ 0 TypeScript errors
- ✅ 0 console errors/warnings
- ✅ <2s initial load time
- ✅ <100ms UI interactions

### Qualitative

- ✅ Visual appearance identical
- ✅ User workflows unchanged
- ✅ Accessibility maintained
- ✅ Code maintainability improved
- ✅ Developer experience enhanced

---

## Appendix A: Key React → Vue Patterns

### JSX → Template Syntax

```tsx
// React
<div className="container">
  {isLoading && <Spinner />}
  {items.map((item) => (
    <Item key={item.id} data={item} />
  ))}
</div>
```

```vue
<!-- Vue -->
<div class="container">
  <Spinner v-if="isLoading" />
  <Item v-for="item in items" :key="item.id" :data="item" />
</div>
```

### Hooks → Composition API

```typescript
// React
const [count, setCount] = useState(0);
useEffect(() => {
  console.log(count);
}, [count]);
```

```typescript
// Vue
const count = ref(0);
watch(count, (newCount) => {
  console.log(newCount);
});
```

### Props & Events

```tsx
// React
interface Props {
  title: string;
  onClose: () => void;
}
const Modal: React.FC<Props> = ({ title, onClose }) => { ... }
```

```vue
<!-- Vue -->
<script setup lang="ts">
interface Props {
  title: string;
}
defineProps<Props>();
const emit = defineEmits<{ close: [] }>();
</script>
```

---

## Appendix B: Agent Communication Protocol

Each agent must:

1. **Read** this spec document
2. **Load** only files listed in their "Input Context"
3. **Produce** artifacts listed in "Output Artifacts"
4. **Validate** against dependencies
5. **Commit** with message: `[AGENT-XXX] Description`
6. **Signal completion** with summary comment

**Example Commit:**

```
[AGENT-005] Migrate ConferencePanel to Vue

- Converted ConferencePanel.tsx to ConferencePanel.vue
- Migrated useConferenceRegistry hook to composable
- Tested conference switching functionality
- All tests passing

Dependencies met: AGENT-002, AGENT-004
```

---

## Document Version History

| Version | Date       | Changes               | Author      |
| ------- | ---------- | --------------------- | ----------- |
| 1.0     | 2025-12-11 | Initial specification | Claude Code |

---

**END OF SPECIFICATION**
