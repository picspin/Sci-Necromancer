export type GenerationMode = 'standard' | 'creative';
export type Conference = 'ISMRM' | 'RSNA' | 'JACC';
export type AbstractType = 'Standard Abstract' | 'MRI in Clinical Practice Abstract' | 'ISMRT Abstract' | 'Registered Abstract';

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
    databaseUrl?: string;
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

// Error types
export interface AppError {
  code: string;
  message: string;
  details?: any;
  recoverable: boolean;
  timestamp: Date;
}

export interface ErrorBoundaryState {
  hasError: boolean;
  error?: AppError;
  errorInfo?: any;
}
