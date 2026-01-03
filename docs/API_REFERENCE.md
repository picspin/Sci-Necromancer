# API Reference

## Core Types (`types.ts`)

### Conference Types

#### `Conference`

```typescript
type Conference = 'ISMRM' | 'RSNA' | 'JACC' | 'ER';
```

Supported medical imaging conferences.

#### `AbstractType`

```typescript
type AbstractType =
  | 'Standard Abstract'
  | 'MRI in Clinical Practice Abstract'
  | 'ISMRT Abstract'
  | 'Registered Abstract'
  | 'RSNA Scientific Abstract'
  | 'JACC Scientific Abstract'
  | 'ER Scientific Abstract';
```

Conference-specific abstract submission types.

### Data Models

#### `AbstractData`

Core abstract data structure containing generated content.

```typescript
interface AbstractData {
  impact: string; // Impact statement (1-2 sentences)
  synopsis: string; // Research synopsis (2-3 sentences)
  keywords: string[]; // Extracted keywords
  abstract?: string; // Full structured abstract body
  categories?: Category[]; // Selected categories
}
```

**Usage:**

```typescript
const abstractData: AbstractData = {
  impact: 'Novel fMRI technique improves connectivity mapping.',
  synopsis: 'We developed a method for high-resolution functional connectivity...',
  keywords: ['fMRI', 'connectivity', 'brain mapping'],
  abstract: '## Background\nFunctional MRI...',
  categories: [{ name: 'Neuro', type: 'main', probability: 0.95 }],
};
```

#### `Category`

Represents a conference submission category.

```typescript
interface Category {
  name: string; // Category name (e.g., "Neuro", "Body")
  type: 'main' | 'sub' | 'secondary'; // Category hierarchy
  probability: number; // AI confidence score (0-1)
}
```

#### `AnalysisResult`

Result of content analysis step.

```typescript
interface AnalysisResult {
  categories: Category[];
  keywords: string[];
}
```

### Settings & Configuration

#### `AIProvider`

```typescript
type AIProvider = 'google' | 'openai';
```

#### `Settings`

Application settings persisted in localStorage.

```typescript
interface Settings {
  provider: AIProvider;
  googleApiKey?: string;
  openAIApiKey?: string;
  openAIBaseUrl?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  openAITextModel?: string;
  openAIVisionModel?: string;
  openAIImageModel?: string;
  databaseEnabled?: boolean;
  mcpConfig?: MCPConfig;
}
```

**Example:**

```typescript
const settings: Settings = {
  provider: 'openai',
  openAIApiKey: 'sk-...',
  openAIBaseUrl: 'https://api.openai.com/v1',
  openAITextModel: 'gpt-4o',
  temperature: 0.7,
  maxTokens: 4000,
};
```

#### `MCPConfig`

Model Context Protocol tools configuration.

```typescript
interface MCPConfig {
  supabase?: SupabaseMCPConfig;
  imageGeneration?: MCPToolConfig;
}

interface SupabaseMCPConfig {
  enabled: boolean;
  apiUrl: string;
  apiKey: string;
  connectionStatus: ConnectionStatus;
  autoSync: boolean;
}

interface MCPToolConfig {
  enabled: boolean;
  baseUrl: string;
  model?: string;
  customHeaders?: Record<string, string>;
  customConfig?: string; // JSON configuration
}
```

### Database Types

#### `SavedAbstract`

Persisted abstract with metadata.

```typescript
interface SavedAbstract {
  id: string;
  title: string;
  conference: Conference;
  abstractType: AbstractType;
  abstractData: AbstractData;
  originalText: string;
  categories?: Category[];
  keywords: string[];
  generationParameters?: GenerationParameters;
  createdAt: Date;
  updatedAt: Date;
  userId?: string;
  syncStatus?: 'local' | 'synced' | 'conflict';
}
```

#### `DatabaseService`

Interface for abstract persistence (local or cloud).

```typescript
interface DatabaseService {
  saveAbstract(abstract: Omit<SavedAbstract, 'id' | 'createdAt' | 'updatedAt'>): Promise<string>;
  loadAbstract(id: string): Promise<SavedAbstract | null>;
  listAbstracts(userId?: string): Promise<SavedAbstract[]>;
  deleteAbstract(id: string): Promise<void>;
  updateAbstract(id: string, updates: Partial<SavedAbstract>): Promise<void>;
  getSyncStatus?(): Promise<SyncStatus>;
}
```

### Conference Module System

#### `ConferenceModule`

Interface for conference-specific implementations.

```typescript
interface ConferenceModule {
  id: Conference;
  name: string;
  submissionUrl: string;
  guidelines: ConferenceGuidelines;
  abstractTypes: AbstractType[];

  generateAbstract(params: AbstractGenerationParams): Promise<AbstractData>;
  validateAbstract(abstract: AbstractData): ValidationResult;
  getCategories(): Category[];
  getKeywords(): string[];
  getColorScheme(): { primary: string; secondary: string; accent: string };
  getDisplayName(): string;
  isAvailable(): boolean;
}
```

#### `ConferenceGuidelines`

Conference-specific formatting rules.

```typescript
interface ConferenceGuidelines {
  abstractTypes: AbstractType[];
  wordLimits: Record<string, number>;
  requiredSections: string[];
  formattingRules: string[];
  submissionDeadlines?: Date[];
}
```

**Example:**

```typescript
const ismrmGuidelines: ConferenceGuidelines = {
  abstractTypes: ['Standard Abstract', 'MRI in Clinical Practice Abstract'],
  wordLimits: {
    'Standard Abstract': 500,
    'MRI in Clinical Practice Abstract': 350,
  },
  requiredSections: ['Background', 'Methods', 'Results', 'Conclusion'],
  formattingRules: [
    'Use structured sections with ## headers',
    'Include 3-5 keywords',
    'Max 2 figures per abstract',
  ],
};
```

### Error Handling

#### `AppError`

Structured error type for application errors.

```typescript
interface AppError {
  code: string;
  message: string;
  details?: any;
  recoverable: boolean;
  timestamp: Date;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  context?: string;
}
```

**Example:**

```typescript
const error: AppError = {
  code: 'API_KEY_MISSING',
  message: 'OpenAI API key is not configured',
  recoverable: true,
  timestamp: new Date(),
  severity: 'high',
  context: 'llm/openai.ts:analyzeContent',
};
```

---

## LLM Services (`lib/llm/`)

### Main Entry Point (`lib/llm/index.ts`)

#### `analyzeContent(inputText: string, conference: Conference): Promise<AnalysisResult>`

Analyzes research content and extracts categories and keywords.

**Parameters:**

- `inputText`: Research paper text or notes
- `conference`: Target conference (affects category extraction)

**Returns:** `AnalysisResult` with categories and keywords

**Example:**

```typescript
import { analyzeContent } from '@/lib/llm';

const result = await analyzeContent(
  'Novel fMRI technique for brain connectivity mapping...',
  'ISMRM'
);
console.log(result.categories); // [{ name: "Neuro", type: "main", ... }]
console.log(result.keywords); // ["fMRI", "connectivity", ...]
```

#### `generateImpactSynopsis(inputText: string, conference: Conference): Promise<{ impact: string; synopsis: string }>`

Generates impact statement and research synopsis.

**Parameters:**

- `inputText`: Research content
- `conference`: Target conference

**Returns:** Object with `impact` and `synopsis` strings

**Example:**

```typescript
const { impact, synopsis } = await generateImpactSynopsis(
  'We developed a new cardiac MRI sequence...',
  'ISMRM'
);
```

#### `generateFinalAbstract(...params): Promise<AbstractData>`

Generates complete conference-ready abstract.

**Parameters:**

- `inputText: string` - Original research content
- `conference: Conference` - Target conference
- `abstractType: AbstractType` - Selected abstract type
- `categories: Category[]` - Selected categories
- `keywords: string[]` - Keywords
- `impact: string` - Impact statement
- `synopsis: string` - Research synopsis

**Returns:** Complete `AbstractData` with structured abstract body

**Example:**

```typescript
const abstract = await generateFinalAbstract(
  inputText,
  'ISMRM',
  'Standard Abstract',
  [{ name: 'Neuro', type: 'main', probability: 0.95 }],
  ['fMRI', 'connectivity'],
  'Novel technique improves mapping accuracy',
  'We developed a high-resolution fMRI method...'
);

console.log(abstract.abstract); // "## Background\n..."
```

#### `generateImage(prompt: string, baseImage?: string): Promise<string>`

Generates scientific figure using configured image generation service.

**Parameters:**

- `prompt: string` - Image description
- `baseImage?: string` - Optional base64 image for image-to-image generation

**Returns:** URL or base64 string of generated image

**Example:**

```typescript
const imageUrl = await generateImage('A scientific diagram showing fMRI brain activation patterns');
```

### Conference-Specific Helpers

#### `generateISMRMAbstract(...params): Promise<AbstractData>`

Shorthand for generating ISMRM abstracts.

#### `generateRSNAAbstract(...params): Promise<AbstractData>`

Shorthand for generating RSNA abstracts.

#### `generateJACCAbstract(...params): Promise<AbstractData>`

Shorthand for generating JACC abstracts.

---

## Settings Context (`context/SettingsContext.tsx`)

### `useSettings()`

React hook for accessing and updating application settings.

**Returns:**

```typescript
{
  settings: Settings;
  updateSettings: (updates: Partial<Settings>) => void;
  saveSettings: (newSettings: Settings) => void;
}
```

**Example:**

```typescript
import { useSettings } from '@/context/SettingsContext';

function ModelConfig() {
  const { settings, updateSettings } = useSettings();

  const handleApiKeyChange = (key: string) => {
    updateSettings({ openAIApiKey: key });
  };

  return (
    <input
      value={settings.openAIApiKey || ''}
      onChange={(e) => handleApiKeyChange(e.target.value)}
    />
  );
}
```

---

## File Processing (`lib/file/`)

### `FileProcessingService`

#### `processFile(file: File): Promise<string>`

Extracts text from uploaded files (.txt, .pdf, .docx).

**Parameters:**

- `file: File` - File object from input

**Returns:** Extracted text content

**Example:**

```typescript
import { FileProcessingService } from '@/lib/file/FileProcessingService';

const processor = new FileProcessingService();
const text = await processor.processFile(uploadedFile);
```

---

## Conference Registry (`lib/conference/`)

### `ConferenceRegistry`

#### `register(module: ConferenceModule): void`

Registers a conference module.

#### `get(id: Conference): ConferenceModule | undefined`

Retrieves registered conference module.

#### `getAll(): ConferenceModule[]`

Returns all registered modules.

#### `isAvailable(id: Conference): boolean`

Checks if conference module is available.

**Example:**

```typescript
import { ConferenceRegistry } from '@/lib/conference/ConferenceRegistry';

const registry = ConferenceRegistry.getInstance();
const ismrm = registry.get('ISMRM');

if (ismrm?.isAvailable()) {
  const categories = ismrm.getCategories();
}
```

---

## Notification Service (`lib/utils/notificationService.ts`)

### `NotificationService`

Pub/sub notification system for displaying user feedback.

#### `subscribe(callback: (notification: Notification) => void): () => void`

Subscribe to notifications.

**Returns:** Unsubscribe function

#### `success(message: string, duration?: number): void`

Show success notification.

#### `error(message: string, duration?: number): void`

Show error notification.

#### `warning(message: string, duration?: number): void`

Show warning notification.

#### `info(message: string, duration?: number): void`

Show info notification.

**Example:**

```typescript
import { notificationService } from '@/lib/utils/notificationService';

// Show success message
notificationService.success('Abstract generated successfully!');

// Show error with custom duration
notificationService.error('Failed to connect to API', 5000);

// Subscribe to notifications
const unsubscribe = notificationService.subscribe((notification) => {
  console.log(`[${notification.type}] ${notification.message}`);
});

// Cleanup
unsubscribe();
```

---

## Testing

Run tests with:

```bash
npm test              # Run all tests
npm run test:ui       # Run with UI
npm run test:coverage # Generate coverage report
```

See individual test files in `__tests__/` directories for usage examples.
