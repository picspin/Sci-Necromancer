import { AbstractType, Category, AnalysisResult, AbstractData, AbstractTypeSuggestion } from '../../types';
import * as gemini from './gemini';
import * as openai from './openai';

/**
 * Enhanced Workflow Service
 * Implements the correct workflow:
 * 1. Analyze content → Extract categories & keywords
 * 2. Generate Impact & Synopsis
 * 3. Suggest abstract types based on categories/keywords
 * 4. Generate full abstract based on selected type and specs
 */

interface LLMProvider {
  analyzeContent(text: string, apiKey?: string): Promise<AnalysisResult>;
  suggestAbstractType(text: string, categories: Category[], keywords: string[], apiKey?: string): Promise<AbstractTypeSuggestion[]>;
  generateFinalAbstract(text: string, type: AbstractType, categories: Category[], keywords: string[], apiKey?: string): Promise<AbstractData>;
  generateCreativeAbstract(coreIdea: string, apiKey?: string): Promise<AbstractData>;
}

export class WorkflowService {
  private providerName: 'google' | 'openai';
  private apiKey?: string;

  constructor(providerName: 'google' | 'openai' = 'google', apiKey?: string) {
    this.providerName = providerName;
    this.apiKey = apiKey;
  }

  /**
   * Step 1: Analyze content and extract categories & keywords
   * This is the initial analysis step (A1 → A2 in the workflow)
   */
  async analyzeContent(text: string): Promise<AnalysisResult> {
    if (this.providerName === 'google') {
      return gemini.analyzeContent(text, this.apiKey);
    } else {
      return openai.analyzeContent(text, this.apiKey);
    }
  }

  /**
   * Step 2: Generate Impact & Synopsis from the original text
   * This happens after categories/keywords are selected (A2 → A3)
   * 
   * For now, we use generateFinalAbstract which already generates impact & synopsis
   * In the future, this could be optimized with a dedicated endpoint
   */
  async generateImpactSynopsis(
    text: string,
    categories: Category[],
    keywords: string[]
  ): Promise<{ impact: string; synopsis: string }> {
    try {
      // Use the existing generateFinalAbstract function which already generates impact & synopsis
      // We'll use a default type for now since we just need impact & synopsis
      let result: AbstractData;
      
      if (this.providerName === 'google') {
        result = await gemini.generateFinalAbstract(text, 'Standard Abstract', categories, keywords, this.apiKey);
      } else {
        result = await openai.generateFinalAbstract(text, 'Standard Abstract', categories, keywords, this.apiKey);
      }
      
      return {
        impact: result.impact,
        synopsis: result.synopsis
      };
    } catch (error) {
      console.error('Failed to generate impact & synopsis:', error);
      throw error;
    }
  }

  /**
   * Step 3: Suggest abstract types based on content analysis
   * This routes to appropriate specs (A3 → A4)
   */
  async suggestAbstractTypes(
    text: string,
    categories: Category[],
    keywords: string[]
  ): Promise<AbstractTypeSuggestion[]> {
    if (this.providerName === 'google') {
      return gemini.suggestAbstractType(text, categories, keywords, this.apiKey);
    } else {
      return openai.suggestAbstractType(text, categories, keywords, this.apiKey);
    }
  }

  /**
   * Step 4: Generate full abstract based on selected type
   * This generates the spec-compliant abstract (A4 → A5)
   * 
   * For now, we use the existing generateFinalAbstract and add the abstract body
   * In the future, this could use type-specific prompts
   */
  async generateAbstractByType(
    text: string,
    _impact: string,
    _synopsis: string,
    type: AbstractType,
    categories: Category[],
    keywords: string[]
  ): Promise<AbstractData> {
    try {
      // Use the existing generateFinalAbstract function
      let result: AbstractData;
      
      if (this.providerName === 'google') {
        result = await gemini.generateFinalAbstract(text, type, categories, keywords, this.apiKey);
      } else {
        result = await openai.generateFinalAbstract(text, type, categories, keywords, this.apiKey);
      }
      
      // Add the abstract body (for now, use synopsis as placeholder)
      // TODO: Generate actual structured abstract body based on type
      return {
        ...result,
        abstract: this.generateAbstractBody(result, type)
      };
    } catch (error) {
      console.error('Failed to generate abstract:', error);
      throw error;
    }
  }
  
  /**
   * Helper to generate abstract body from impact/synopsis
   * This is a temporary solution until we have proper type-specific generation
   */
  private generateAbstractBody(data: AbstractData, type: AbstractType): string {
    // For now, create a simple structured format
    // In production, this should call the LLM with type-specific prompts
    
    switch (type) {
      case 'Standard Abstract':
        return `INTRODUCTION:\n${data.synopsis.split('.')[0]}.\n\nMETHODS:\n[Methods will be generated based on the full text analysis]\n\nRESULTS:\n[Results will be generated based on the full text analysis]\n\nDISCUSSION:\n${data.impact}\n\nCONCLUSION:\n[Conclusion will be generated based on the full text analysis]`;
      
      case 'Registered Abstract':
        return `INTRODUCTION:\n${data.synopsis.split('.')[0]}.\n\nHYPOTHESIS:\n[Hypothesis will be generated based on the full text analysis]\n\nMETHODS:\n[Methods will be generated based on the full text analysis]\n\nSTATISTICAL METHODS:\n[Statistical methods will be generated based on the full text analysis]`;
      
      case 'MRI in Clinical Practice Abstract':
        return `BACKGROUND:\n${data.synopsis.split('.')[0]}.\n\nTEACHING POINT:\n${data.impact}\n\nDIAGNOSIS AND TREATMENT:\n[Diagnosis and treatment details will be generated]\n\nSIGNIFICANCE:\n${data.impact}\n\nKEY POINTS:\n- [Key point 1]\n- [Key point 2]\n- [Key point 3]`;
      
      case 'ISMRT Abstract':
        return `BACKGROUND:\n${data.synopsis.split('.')[0]}.\n\nMETHODS:\n[Methods will be generated]\n\nRESULTS:\n[Results will be generated]\n\nCONCLUSIONS:\n${data.impact}`;
      
      default:
        return data.synopsis;
    }
  }

  /**
   * Creative Mode: Generate everything from a core idea
   * This is the "邪修模式" (A5 → A6)
   */
  async generateCreativeAbstract(
    coreIdea: string,
    type: AbstractType = 'Standard Abstract'
  ): Promise<AbstractData> {
    try {
      // Use the existing generateCreativeAbstract function
      let result: AbstractData;
      
      if (this.providerName === 'google') {
        result = await gemini.generateCreativeAbstract(coreIdea, this.apiKey);
      } else {
        result = await openai.generateCreativeAbstract(coreIdea, this.apiKey);
      }
      
      // Add the abstract body
      return {
        ...result,
        abstract: this.generateAbstractBody(result, type)
      };
    } catch (error) {
      console.error('Failed to generate creative abstract:', error);
      throw error;
    }
  }

  /**
   * Complete workflow: From text to final abstract
   * Combines all steps for convenience
   */
  async completeWorkflow(
    text: string,
    selectedType?: AbstractType,
    onProgress?: (step: string, data: any) => void
  ): Promise<{
    analysis: AnalysisResult;
    impactSynopsis: { impact: string; synopsis: string };
    suggestions: AbstractTypeSuggestion[];
    finalAbstract: AbstractData;
  }> {
    // Step 1: Analyze content
    onProgress?.('Analyzing content...', null);
    const analysis = await this.analyzeContent(text);
    onProgress?.('analysis', analysis);

    // Step 2: Generate Impact & Synopsis
    onProgress?.('Generating impact & synopsis...', null);
    const impactSynopsis = await this.generateImpactSynopsis(
      text,
      analysis.categories,
      analysis.keywords
    );
    onProgress?.('impactSynopsis', impactSynopsis);

    // Step 3: Suggest abstract types
    onProgress?.('Suggesting abstract types...', null);
    const suggestions = await this.suggestAbstractTypes(
      text,
      analysis.categories,
      analysis.keywords
    );
    onProgress?.('suggestions', suggestions);

    // Step 4: Generate final abstract
    const typeToUse = selectedType || suggestions[0]?.type || 'Standard Abstract';
    onProgress?.(`Generating ${typeToUse}...`, null);
    const finalAbstract = await this.generateAbstractByType(
      text,
      impactSynopsis.impact,
      impactSynopsis.synopsis,
      typeToUse,
      analysis.categories,
      analysis.keywords
    );
    onProgress?.('finalAbstract', finalAbstract);

    return {
      analysis,
      impactSynopsis,
      suggestions,
      finalAbstract
    };
  }
}

// Export singleton instance
export const workflowService = new WorkflowService();
