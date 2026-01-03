export type GenerationMode = 'standard' | 'creative';
export type Conference = 'ISMRM' | 'RSNA' | 'ER' | 'ESC' | 'IMAGE';
export type AbstractType =
  // ISMRM Types
  | 'Standard Abstract'
  | 'MRI in Clinical Practice Abstract'
  | 'ISMRT Abstract'
  | 'Registered Abstract'
  // RSNA Types
  | 'RSNA Scientific Abstract'
  // ESC Types
  | 'ESC Scientific Abstract'
  | 'ESC Young Investigator Award'
  // ER/ECR Types (European Congress of Radiology)
  | 'ER Scientific Abstract'
  | 'ECR Research Presentation'
  | 'ECR Clinical Trials in Radiology'
  | 'ECR EPOS Scientific Poster'
  | 'ECR EPOS Educational Poster'
  | 'ECR Student Presentation';

export interface AbstractData {
  impact: string;
  synopsis: string;
  keywords: string[];
  abstract?: string; // Full abstract body with structured sections
  categories?: Category[]; // Categories selected during generation
}

export interface ImageState {
  file: File | null;
  specs: string;
  base64: string | null;
}

// New types for the workflow
export interface AnalysisResult {
  categories: Category[];
  keywords: string[];
}

export interface Category {
  name: string;
  type: 'main' | 'sub' | 'secondary';
  probability: number;
}

export interface AbstractTypeSuggestion {
  type: AbstractType;
  probability: number;
}

// New types for Model Manager Settings
export type AIProvider = 'google' | 'openai';
export type ConnectionStatus = 'connected' | 'disconnected' | 'error' | 'connecting';

export interface SupabaseMCPConfig {
  enabled: boolean;
  apiUrl: string;
  apiKey: string;
  connectionStatus: ConnectionStatus;
  autoSync: boolean;
  lastConnectionTest?: Date;
  errorMessage?: string;
}

export interface MCPToolConfig {
  enabled: boolean;
  baseUrl: string;
  model?: string;
  customHeaders?: Record<string, string>;
  customConfig?: string; // JSON string for tool-specific configuration
}

export interface MCPConfig {
  supabase?: SupabaseMCPConfig;
  imageGeneration?: MCPToolConfig;
  // Future MCP tools can be added here
}

export interface Settings {
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
  databaseUrl?: string; // Legacy - will be moved to MCP config
  supabaseMCP?: SupabaseMCPConfig; // Legacy - moved to mcpConfig
  databaseEnabled?: boolean; // User preference for cloud storage
  mcpConfig?: MCPConfig; // New unified MCP configuration
}

// Database types
export interface SavedAbstract {
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

export interface DatabaseService {
  saveAbstract(abstract: Omit<SavedAbstract, 'id' | 'createdAt' | 'updatedAt'>): Promise<string>;
  loadAbstract(id: string): Promise<SavedAbstract | null>;
  listAbstracts(userId?: string): Promise<SavedAbstract[]>;
  deleteAbstract(id: string): Promise<void>;
  updateAbstract(id: string, updates: Partial<SavedAbstract>): Promise<void>;
  getSyncStatus?(): Promise<SyncStatus>;
}

export interface SyncStatus {
  isOnline: boolean;
  lastSync: Date | null;
  pendingChanges: number;
  conflictCount: number;
}

export interface ConflictResolution {
  abstractId: string;
  resolution: 'local' | 'remote' | 'merge';
  localVersion: Partial<SavedAbstract>;
  remoteVersion: Partial<SavedAbstract>;
}

export interface GenerationParameters {
  provider: 'google' | 'openai';
  model: string;
  categories?: Category[];
  keywords?: string[];
  abstractType?: AbstractType;
  temperature?: number;
  maxTokens?: number;
}

// Writing Style Configuration
export interface WritingStyleConfig {
  balanceFormalConversational: boolean;
  clearSubjects: boolean;
  shortSentences: boolean;
  rhythmControl: boolean;
  faithfulnessToOriginal: boolean;
  styleConsistency: boolean;
  naturalExpression: boolean;
  logicalRigor: boolean;
  eliminateAITone: boolean;
  prohibitedPhrases: string[];
}

// Conference Module System
export interface ConferenceGuidelines {
  abstractTypes: AbstractType[];
  wordLimits: Record<string, number>;
  requiredSections: string[];
  formattingRules: string[];
  submissionDeadlines?: Date[];
}

export interface ConferenceModule {
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

export interface AbstractGenerationParams {
  inputText: string;
  abstractType: AbstractType;
  categories: Category[];
  keywords: string[];
  impact?: string;
  synopsis?: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// Error types
export interface AppError {
  code: string;
  message: string;
  details?: any;
  recoverable: boolean;
  timestamp: Date;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  context?: string;
}

export interface ErrorBoundaryState {
  hasError: boolean;
  error?: AppError;
  errorInfo?: any;
}

// ============================================================================
// IMAGE GENERATION PANEL TYPES
// ============================================================================

export type ImageGenerationMode = 'standard' | 'text-to-image';

export type ImageSpecCategory = 'research' | 'journal' | 'layout' | 'style' | 'format' | 'elements';

// Structured image specification field
export interface ImageSpecField {
  key: string;
  value: string;
  category: ImageSpecCategory;
  isValid: boolean;
}

// State for the image specs smart completion form
export interface ImageSpecsState {
  rawInput: string; // User's raw text input
  parsedFields: ImageSpecField[]; // Extracted structured fields
  jsonOutput: string; // Final JSON for LLM API
  selectedTemplate: string | null; // Applied template ID
  cursorPosition: number; // Current cursor position for completion
  showSuggestions: boolean; // Whether to show autocomplete popup
  suggestions: string[]; // Current autocomplete suggestions
}

// Main state for the Image Generation panel
export interface ImageGenerationState {
  mode: ImageGenerationMode;
  imageFile: File | null;
  imageBase64: string | null;
  specsState: ImageSpecsState;
  abstractIntent: SavedAbstract | null; // Selected from Abstract Manager for text-to-image
  generatedImage: string | null;
  isLoading: boolean;
  loadingMessage: string;
  error: string | null;
  zoomLevel: number;
}

// Template for one-click image specs
export interface ImageTemplate {
  id: string;
  name: string;
  icon: string;
  description: string;
  defaultFields: ImageSpecField[];
}

// Autocomplete suggestion item
export interface CompletionSuggestion {
  text: string;
  category: ImageSpecCategory;
  description?: string;
}

// Trigger mapping for rule-based completion
export interface TriggerMapping {
  pattern: RegExp;
  category: ImageSpecCategory;
  values: string[];
}

// Structured output for LLM image generation
export interface StructuredImagePrompt {
  research_type: string;
  journal_style: string;
  layout: string;
  color_palette: string;
  aspect_ratio: string;
  resolution: string;
  elements: string[];
  notes: string;
  intent?: string; // From Abstract Manager
}
