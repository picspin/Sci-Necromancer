export type GenerationMode = 'standard' | 'creative';
export type Conference = 'ISMRM' | 'RSNA' | 'JACC' | 'ER';
export type AbstractType = 
  // ISMRM Types
  | 'Standard Abstract' 
  | 'MRI in Clinical Practice Abstract' 
  | 'ISMRT Abstract' 
  | 'Registered Abstract'
  // RSNA Types
  | 'RSNA Scientific Abstract'
  // JACC Types
  | 'JACC Scientific Abstract'
  // ER Types
  | 'ER Scientific Abstract';

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
