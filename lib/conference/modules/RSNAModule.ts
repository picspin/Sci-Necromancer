import {
  Conference,
  ConferenceGuidelines,
  AbstractType,
  AbstractData,
  AbstractGenerationParams,
  ValidationResult,
  Category,
} from '../../../types';
import { BaseConferenceModule } from '../BaseConferenceModule';
import { RSNA_CATEGORIES, RSNA_KEYWORDS, RSNA_RULESET, validateRSNADraft } from '../rsnaRules';
import * as llm from '../../llm';

/**
 * RSNA Conference Module
 * Handles RSNA-specific abstract generation and validation
 */
export class RSNAModule extends BaseConferenceModule {
  readonly id: Conference = 'RSNA';
  readonly name: string = 'RSNA Radiology';
  readonly submissionUrl: string = 'https://mc.manuscriptcentral.com/rad';

  readonly guidelines: ConferenceGuidelines = {
    abstractTypes: ['RSNA Science Abstract', 'RSNA Education Exhibit'],
    wordLimits: {
      abstract: RSNA_RULESET.science.abstractCharactersExcludingSpaces,
      impact: RSNA_RULESET.science.clinicalRelevanceCharacters,
      synopsis: 100,
    },
    requiredSections: ['purpose', 'methods', 'results', 'conclusion'],
    formattingRules: [
      'Use structured format with Purpose, Methods, Results, Conclusion',
      'Include statistical analysis where appropriate',
      'Follow RSNA scientific abstract guidelines',
    ],
  };

  readonly abstractTypes: AbstractType[] = ['RSNA Science Abstract', 'RSNA Education Exhibit'];

  /**
   * RSNA has conference-specific generation methods
   */
  protected hasConferenceSpecificGeneration(): boolean {
    return true;
  }

  /**
   * Generate RSNA-specific abstract
   */
  protected async generateConferenceSpecificAbstract(
    params: AbstractGenerationParams
  ): Promise<AbstractData> {
    try {
      // Check if conference-specific LLM methods exist
      if (typeof llm.generateAbstractForConference === 'function') {
        return await llm.generateAbstractForConference(
          params.inputText,
          params.abstractType,
          params.categories,
          params.keywords,
          'RSNA'
        );
      } else {
        // Fallback to generic generation with RSNA-specific prompting
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
      throw new Error(
        `RSNA abstract generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get RSNA-specific categories
   */
  getCategories(): Category[] {
    return RSNA_CATEGORIES.map((name) => ({ name, type: 'main', probability: 1 }));
  }

  /**
   * RSNA 2023 fallback rules use character limits and distinct science/education contracts,
   * so the generic word-count validator is intentionally bypassed.
   */
  override validateAbstract(abstract: AbstractData): ValidationResult {
    return validateRSNADraft(abstract);
  }

  /**
   * Get RSNA-specific keywords
   */
  getKeywords(): string[] {
    return [...RSNA_KEYWORDS];
  }

  /**
   * RSNA-specific validation
   */
  protected validateConferenceSpecific(abstract: AbstractData): ValidationResult {
    return validateRSNADraft(abstract);
  }

  /**
   * Get RSNA display name
   */
  getDisplayName(): string {
    return 'RSNA Radiology';
  }
}
