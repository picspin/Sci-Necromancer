import * as gemini from './gemini';
import * as openai from './openai';
import { AbstractData, ImageState, AnalysisResult, Category, AbstractType, AbstractTypeSuggestion, AIProvider, Conference } from '../../types';
import { withRetry, createAppError, shouldRetry, DEFAULT_RETRY_CONFIG } from '../utils/retryUtils';

interface LLMService {
  analyzeContent(text: string, apiKey?: string): Promise<AnalysisResult>;
  suggestAbstractType(text: string, categories: Category[], keywords: string[], apiKey?: string): Promise<AbstractTypeSuggestion[]>;
  generateFinalAbstract(text: string, type: AbstractType, categories: Category[], keywords: string[], apiKey?: string): Promise<AbstractData>;
  generateCreativeAbstract(coreIdea: string, apiKey?: string): Promise<AbstractData>;
  generateImage(imageState: ImageState, creativeContext: string, apiKey?: string): Promise<string>;
}

class EnhancedLLMService {
  private primaryProvider: AIProvider;
  private fallbackProvider: AIProvider;
  private offlineMode: boolean = false;

  constructor() {
    this.primaryProvider = this.getStoredProvider();
    this.fallbackProvider = this.primaryProvider === 'google' ? 'openai' : 'google';
  }

  private getStoredProvider(): AIProvider {
    try {
      const savedSettings = localStorage.getItem('app-settings');
      if (savedSettings) {
        const settings = JSON.parse(savedSettings);
        return settings.provider || 'google';
      }
    } catch (e) {
      console.warn('Failed to load provider settings:', e);
    }
    return 'google';
  }

  private getStoredSettings() {
    try {
      const savedSettings = localStorage.getItem('app-settings');
      if (savedSettings) {
        return JSON.parse(savedSettings);
      }
    } catch (e) {
      console.warn('Failed to load settings:', e);
    }
    return {};
  }

  private getService(provider: AIProvider): LLMService {
    return provider === 'openai' ? openai : gemini;
  }

  private getApiKey(provider: AIProvider): string | undefined {
    const settings = this.getStoredSettings();
    return provider === 'openai' ? settings.openAIApiKey : settings.googleApiKey;
  }

  private async executeWithFallback<T>(
    operation: (service: LLMService, apiKey?: string) => Promise<T>,
    context: string
  ): Promise<T> {
    // If in offline mode, throw immediately
    if (this.offlineMode) {
      throw new Error('Service unavailable in offline mode');
    }

    let primaryError: Error | null = null;

    // Try primary provider with retry
    try {
      const primaryService = this.getService(this.primaryProvider);
      const primaryApiKey = this.getApiKey(this.primaryProvider);
      return await withRetry(
        () => operation(primaryService, primaryApiKey),
        DEFAULT_RETRY_CONFIG,
        `${context} (${this.primaryProvider})`
      );
    } catch (error) {
      primaryError = error as Error;
      console.warn(`Primary provider (${this.primaryProvider}) failed for ${context}:`, error);
    }

    // Try fallback provider
    try {
      console.log(`Attempting fallback to ${this.fallbackProvider} for ${context}`);
      const fallbackService = this.getService(this.fallbackProvider);
      const fallbackApiKey = this.getApiKey(this.fallbackProvider);
      return await withRetry(
        () => operation(fallbackService, fallbackApiKey),
        { ...DEFAULT_RETRY_CONFIG, maxAttempts: 2 }, // Fewer retries for fallback
        `${context} (${this.fallbackProvider} fallback)`
      );
    } catch (fallbackError) {
      console.error(`Both providers failed for ${context}:`, {
        primary: primaryError?.message,
        fallback: (fallbackError as Error)?.message
      });

      // Check if we should enter offline mode
      if (shouldRetry(primaryError) && shouldRetry(fallbackError)) {
        this.offlineMode = true;
        console.warn('Entering offline mode due to repeated network failures');
      }

      // Throw the primary error as it's more relevant
      throw createAppError(primaryError || fallbackError, context);
    }
  }

  async analyzeContent(text: string): Promise<AnalysisResult> {
    return this.executeWithFallback(
      (service, apiKey) => service.analyzeContent(text, apiKey),
      'Content Analysis'
    );
  }

  async suggestAbstractType(
    text: string, 
    categories: Category[], 
    keywords: string[]
  ): Promise<AbstractTypeSuggestion[]> {
    return this.executeWithFallback(
      (service, apiKey) => service.suggestAbstractType(text, categories, keywords, apiKey),
      'Abstract Type Suggestion'
    );
  }

  async generateFinalAbstract(
    text: string, 
    type: AbstractType, 
    categories: Category[], 
    keywords: string[]
  ): Promise<AbstractData> {
    return this.executeWithFallback(
      (service, apiKey) => service.generateFinalAbstract(text, type, categories, keywords, apiKey),
      'Final Abstract Generation'
    );
  }

  async generateCreativeAbstract(coreIdea: string): Promise<AbstractData> {
    return this.executeWithFallback(
      (service, apiKey) => service.generateCreativeAbstract(coreIdea, apiKey),
      'Creative Abstract Generation'
    );
  }

  async generateImage(imageState: ImageState, creativeContext: string): Promise<string> {
    return this.executeWithFallback(
      (service, apiKey) => service.generateImage(imageState, creativeContext, apiKey),
      'Image Generation'
    );
  }

  // Utility methods
  isOffline(): boolean {
    return this.offlineMode;
  }

  exitOfflineMode(): void {
    this.offlineMode = false;
    console.log('Exited offline mode');
  }

  switchProvider(newProvider: AIProvider): void {
    this.primaryProvider = newProvider;
    this.fallbackProvider = newProvider === 'google' ? 'openai' : 'google';
    this.offlineMode = false; // Reset offline mode when switching providers
    console.log(`Switched to ${newProvider} provider with ${this.fallbackProvider} fallback`);
  }

  getCurrentProvider(): AIProvider {
    return this.primaryProvider;
  }

  // Conference-specific methods
  async analyzeContentForConference(text: string, conference: Conference): Promise<AnalysisResult> {
    return this.executeWithFallback(
      async (service, apiKey) => {
        // Load conference-specific categories and keywords
        const conferenceData = await this.loadConferenceData(conference);
        
        // For now, use the existing analyzeContent method
        // In a full implementation, this would use conference-specific prompts
        const result = await service.analyzeContent(text, apiKey);
        
        // Filter and adapt results for the specific conference
        return this.adaptResultsForConference(result, conference, conferenceData);
      },
      `Content Analysis for ${conference}`
    );
  }

  async generateAbstractForConference(
    text: string, 
    type: AbstractType, 
    categories: Category[], 
    keywords: string[], 
    conference: Conference
  ): Promise<AbstractData> {
    return this.executeWithFallback(
      async (service, apiKey) => {
        // Load conference-specific guidelines
        await this.loadConferenceGuidelines(conference, type);
        
        // For now, use the existing generateFinalAbstract method
        // In a full implementation, this would use conference-specific prompts
        return service.generateFinalAbstract(text, type, categories, keywords, apiKey);
      },
      `Abstract Generation for ${conference}`
    );
  }

  async generateCreativeAbstractForConference(coreIdea: string, conference: Conference): Promise<AbstractData> {
    return this.executeWithFallback(
      async (service, apiKey) => {
        // Load conference-specific creative guidelines
        await this.loadConferenceGuidelines(conference, 'RSNA Scientific Abstract');
        
        // For now, use the existing generateCreativeAbstract method
        return service.generateCreativeAbstract(coreIdea, apiKey);
      },
      `Creative Abstract Generation for ${conference}`
    );
  }

  // Helper methods for conference-specific data
  private async loadConferenceData(conference: Conference): Promise<any> {
    try {
      switch (conference) {
        case 'RSNA':
          // Load RSNA categories and keywords
          const response = await fetch('/rsna-categories-keywords.md');
          return await response.text();
        case 'JACC':
          // Load JACC categories and keywords
          const jaccResponse = await fetch('/jacc-categories-keywords.md');
          return await jaccResponse.text();
        default:
          // Default to ISMRM
          const ismrmResponse = await fetch('/ismrm abstract categories & keywords.md');
          return await ismrmResponse.text();
      }
    } catch (error) {
      console.warn(`Failed to load conference data for ${conference}:`, error);
      return '';
    }
  }

  private async loadConferenceGuidelines(conference: Conference, type: AbstractType): Promise<string> {
    try {
      switch (conference) {
        case 'RSNA':
          if (type === 'RSNA Scientific Abstract') {
            const response = await fetch('/rsna-scientific-abstract-specs.md');
            return await response.text();
          }
          break;
        case 'JACC':
          if (type === 'JACC Scientific Abstract') {
            const response = await fetch('/jacc-scientific-abstract-specs.md');
            return await response.text();
          }
          break;
        default:
          // Default to ISMRM guidelines
          const response = await fetch('/standard abstract guidance.md');
          return await response.text();
      }
    } catch (error) {
      console.warn(`Failed to load guidelines for ${conference} ${type}:`, error);
    }
    return '';
  }

  private adaptResultsForConference(
    result: AnalysisResult, 
    conference: Conference, 
    conferenceData: string
  ): AnalysisResult {
    // For RSNA, adapt categories to radiology-specific ones
    if (conference === 'RSNA') {
      const rsnaCategories = this.extractRSNACategories(result.categories, conferenceData);
      const rsnaKeywords = this.extractRSNAKeywords(result.keywords, conferenceData);
      
      return {
        categories: rsnaCategories,
        keywords: rsnaKeywords
      };
    }
    
    // For JACC, adapt categories to cardiovascular-specific ones
    if (conference === 'JACC') {
      const jaccCategories = this.extractJACCCategories(result.categories, conferenceData);
      const jaccKeywords = this.extractJACCKeywords(result.keywords, conferenceData);
      
      return {
        categories: jaccCategories,
        keywords: jaccKeywords
      };
    }
    
    // For other conferences, return as-is
    return result;
  }

  private extractRSNACategories(categories: Category[], _conferenceData: string): Category[] {
    // Map ISMRM categories to RSNA categories
    const rsnaMapping: { [key: string]: string } = {
      'Neuro': 'Neuroradiology',
      'Body': 'Abdominal Imaging',
      'Cardiovascular': 'Cardiac Imaging',
      'Musculoskeletal': 'Musculoskeletal Imaging',
      'Pediatrics': 'Pediatric Imaging',
      'Physics & Engineering': 'Physics',
      'Interventional': 'Interventional Radiology'
    };

    return categories.map(cat => ({
      ...cat,
      name: rsnaMapping[cat.name] || cat.name
    }));
  }

  private extractRSNAKeywords(keywords: string[], _conferenceData: string): string[] {
    // Add RSNA-specific keywords and filter relevant ones
    const rsnaKeywords = [
      'Diagnostic Accuracy',
      'Clinical Outcomes',
      'Image Quality',
      'Workflow Optimization',
      'Patient Safety',
      'Cost-effectiveness'
    ];

    // Combine original keywords with RSNA-specific ones
    const combinedKeywords = [...keywords];
    
    // Add relevant RSNA keywords that aren't already present
    rsnaKeywords.forEach(keyword => {
      if (!combinedKeywords.some(k => k.toLowerCase().includes(keyword.toLowerCase()))) {
        combinedKeywords.push(keyword);
      }
    });

    return combinedKeywords.slice(0, 10); // Limit to 10 keywords
  }

  private extractJACCCategories(categories: Category[], _conferenceData: string): Category[] {
    // Map ISMRM categories to JACC categories
    const jaccMapping: { [key: string]: string } = {
      'Cardiovascular': 'Coronary Artery Disease',
      'Body': 'Cardiac Imaging',
      'Neuro': 'Cardiac Surgery',
      'Interventional': 'Interventional Cardiology',
      'Physics & Engineering': 'Cardiac Imaging',
      'Pediatrics': 'Congenital Heart Disease'
    };

    return categories.map(cat => ({
      ...cat,
      name: jaccMapping[cat.name] || 'Cardiovascular Medicine'
    }));
  }

  private extractJACCKeywords(keywords: string[], _conferenceData: string): string[] {
    // Add JACC-specific cardiovascular keywords
    const jaccKeywords = [
      'Cardiovascular Outcomes',
      'MACE',
      'Myocardial Infarction',
      'Heart Failure',
      'Coronary Artery Disease',
      'Cardiac Imaging',
      'Interventional Cardiology',
      'Clinical Trials',
      'Biomarkers',
      'Cardiovascular Risk'
    ];

    // Combine original keywords with JACC-specific ones
    const combinedKeywords = [...keywords];
    
    // Add relevant JACC keywords that aren't already present
    jaccKeywords.forEach(keyword => {
      if (!combinedKeywords.some(k => k.toLowerCase().includes(keyword.toLowerCase()))) {
        combinedKeywords.push(keyword);
      }
    });

    return combinedKeywords.slice(0, 10); // Limit to 10 keywords
  }

  // Offline mode fallbacks
  getOfflineFallbacks(): {
    analyzeContent: (text: string) => AnalysisResult;
    generateBasicAbstract: (text: string) => AbstractData;
  } {
    return {
      analyzeContent: (text: string): AnalysisResult => {
        // Basic text analysis without AI
        const words = text.toLowerCase().split(/\s+/);
        const categories: Category[] = [];
        const keywords: string[] = [];

        // Simple keyword extraction based on frequency
        const wordCount = new Map<string, number>();
        words.forEach(word => {
          if (word.length > 3) {
            wordCount.set(word, (wordCount.get(word) || 0) + 1);
          }
        });

        // Get top keywords
        const sortedWords = Array.from(wordCount.entries())
          .sort(([,a], [,b]) => b - a)
          .slice(0, 10)
          .map(([word]) => word);

        keywords.push(...sortedWords);

        return { categories, keywords };
      },

      generateBasicAbstract: (text: string): AbstractData => {
        // Extract first few sentences as impact
        const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
        const impact = sentences.slice(0, 2).join('. ').trim() + '.';
        const synopsis = sentences.slice(2, 5).join('. ').trim() + '.';

        return {
          impact: impact || 'Impact statement unavailable in offline mode.',
          synopsis: synopsis || 'Synopsis unavailable in offline mode.',
          keywords: ['offline', 'basic-processing']
        };
      }
    };
  }
}

// Export singleton instance
export const enhancedLLMService = new EnhancedLLMService();
