import { 
  Conference, 
  ConferenceModule, 
  ConferenceGuidelines, 
  AbstractType, 
  AbstractData, 
  AbstractGenerationParams, 
  ValidationResult, 
  Category 
} from '../../types';
import * as llm from '../llm';

/**
 * Abstract base class for all conference modules
 * Provides common functionality and enforces interface compliance
 */
export abstract class BaseConferenceModule implements ConferenceModule {
  abstract readonly id: Conference;
  abstract readonly name: string;
  abstract readonly submissionUrl: string;
  abstract readonly guidelines: ConferenceGuidelines;
  abstract readonly abstractTypes: AbstractType[];

  /**
   * Generate an abstract for this conference
   */
  async generateAbstract(params: AbstractGenerationParams): Promise<AbstractData> {
    try {
      // Use conference-specific generation if available, otherwise fall back to generic
      if (this.hasConferenceSpecificGeneration()) {
        return await this.generateConferenceSpecificAbstract(params);
      } else {
        return await llm.generateFinalAbstract(
          params.inputText,
          params.abstractType,
          params.categories,
          params.keywords,
          params.impact || '',
          params.synopsis || ''
        );
      }
    } catch (error) {
      throw new Error(`Failed to generate ${this.id} abstract: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate an abstract against conference requirements
   */
  validateAbstract(abstract: AbstractData): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check word limits
    if (abstract.abstract) {
      const wordCount = this.countWords(abstract.abstract);
      const limit = this.guidelines.wordLimits.abstract || 300;
      
      if (wordCount > limit) {
        errors.push(`Abstract exceeds word limit: ${wordCount}/${limit} words`);
      } else if (wordCount > limit * 0.9) {
        warnings.push(`Abstract is close to word limit: ${wordCount}/${limit} words`);
      }
    }

    // Check impact word limit
    if (abstract.impact) {
      const impactWordCount = this.countWords(abstract.impact);
      const impactLimit = this.guidelines.wordLimits.impact || 40;
      
      if (impactWordCount > impactLimit) {
        errors.push(`Impact statement exceeds word limit: ${impactWordCount}/${impactLimit} words`);
      }
    }

    // Check synopsis word limit
    if (abstract.synopsis) {
      const synopsisWordCount = this.countWords(abstract.synopsis);
      const synopsisLimit = this.guidelines.wordLimits.synopsis || 100;
      
      if (synopsisWordCount > synopsisLimit) {
        errors.push(`Synopsis exceeds word limit: ${synopsisWordCount}/${synopsisLimit} words`);
      }
    }

    // Check required keywords
    if (!abstract.keywords || abstract.keywords.length === 0) {
      errors.push('At least one keyword is required');
    }

    // Conference-specific validation
    const conferenceValidation = this.validateConferenceSpecific(abstract);
    errors.push(...conferenceValidation.errors);
    warnings.push(...conferenceValidation.warnings);

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Get available categories for this conference
   */
  abstract getCategories(): Category[];

  /**
   * Get available keywords for this conference
   */
  abstract getKeywords(): string[];

  /**
   * Check if conference has specific generation methods
   */
  protected hasConferenceSpecificGeneration(): boolean {
    return false; // Override in subclasses if they have specific generation
  }

  /**
   * Generate conference-specific abstract (override in subclasses)
   */
  protected async generateConferenceSpecificAbstract(_params: AbstractGenerationParams): Promise<AbstractData> {
    throw new Error('Conference-specific generation not implemented');
  }

  /**
   * Conference-specific validation (override in subclasses)
   */
  protected validateConferenceSpecific(_abstract: AbstractData): ValidationResult {
    return { isValid: true, errors: [], warnings: [] };
  }

  /**
   * Utility method to count words
   */
  protected countWords(text: string): number {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  }

  /**
   * Get conference-specific color scheme
   */
  getColorScheme(): { primary: string; secondary: string; accent: string } {
    const colorSchemes = {
      ISMRM: { primary: '#4CAF50', secondary: '#81C784', accent: '#2E7D32' },
      RSNA: { primary: '#2196F3', secondary: '#64B5F6', accent: '#1565C0' },
      JACC: { primary: '#FF9800', secondary: '#FFB74D', accent: '#E65100' },
      ER: { primary: '#9C27B0', secondary: '#BA68C8', accent: '#6A1B9A' }
    };
    
    return colorSchemes[this.id] || { primary: '#9E9E9E', secondary: '#BDBDBD', accent: '#616161' };
  }

  /**
   * Get conference display name with branding
   */
  getDisplayName(): string {
    return this.name;
  }

  /**
   * Check if conference module is available/implemented
   */
  isAvailable(): boolean {
    return true; // Override in subclasses if needed
  }
}
