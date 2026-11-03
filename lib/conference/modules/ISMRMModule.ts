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
import * as llm from '../../llm';
import {
  ISMRM_2027_RULES,
  ISMRM_SUBCATEGORIES,
  ISMRM_GENERAL_KEYWORDS,
} from '../../llm/prompts/ismrmData';

/**
 * ISMRM Conference Module
 * Handles ISMRM-specific abstract generation and validation
 */
export class ISMRMModule extends BaseConferenceModule {
  readonly id: Conference = 'ISMRM';
  readonly name: string = 'ISMRM Abstract Assistant';
  readonly submissionUrl: string = ISMRM_2027_RULES.submissionUrl;

  readonly guidelines: ConferenceGuidelines = {
    abstractTypes: [...ISMRM_2027_RULES.abstractTypes],
    wordLimits: { ...ISMRM_2027_RULES.wordLimits },
    requiredSections: ['impact', 'synopsis'],
    formattingRules: [
      'Use structured format with clear sections',
      'Include quantitative results where possible',
      'ISMRM 2027: English; title <=125 characters; body <=750 words excluding References',
      'Up to 5 figures, <=500-character captions, and a separate caption-free Preview Figure',
      'Standard/Tandem Synopsis: Motivation, Goals, Approach, Results; clinical Synopsis: unstructured',
      'Funding, code, data, links and platform AI disclosure stay in separate Acknowledgements',
    ],
  };

  readonly abstractTypes: AbstractType[] = [...ISMRM_2027_RULES.abstractTypes];

  /**
   * ISMRM has conference-specific generation methods
   */
  protected hasConferenceSpecificGeneration(): boolean {
    return true;
  }

  /**
   * Generate ISMRM-specific abstract
   */
  protected async generateConferenceSpecificAbstract(
    params: AbstractGenerationParams
  ): Promise<AbstractData> {
    try {
      return await llm.generateFinalAbstract(
        params.inputText,
        params.abstractType,
        params.categories,
        params.keywords,
        params.impact || '',
        params.synopsis || ''
      );
    } catch (error) {
      throw new Error(
        `ISMRM abstract generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get ISMRM-specific categories
   */
  getCategories(): Category[] {
    return ISMRM_SUBCATEGORIES.map(({ name }) => ({ name, type: 'main', probability: 1 }));
  }

  /**
   * Get ISMRM-specific keywords
   */
  getKeywords(): string[] {
    return [...ISMRM_GENERAL_KEYWORDS];
  }

  validateAbstract(abstract: AbstractData): ValidationResult {
    // Only the body counts towards 750 words; keep References in the real output.
    const body = abstract.abstract?.split(
      /\n\s*(?:#{1,6}\s*)?(?:\*\*)?REFERENCES(?:\*\*)?\s*(?::|\r?\n|$)/i
    )[0];
    return super.validateAbstract({ ...abstract, abstract: body });
  }

  /**
   * ISMRM-specific validation
   */
  protected validateConferenceSpecific(abstract: AbstractData): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (abstract.title && [...abstract.title].length > ISMRM_2027_RULES.titleCharacters) {
      errors.push('ISMRM 2027 title exceeds 125 characters');
    }
    if (abstract.keywords?.length > ISMRM_2027_RULES.maxKeywords) {
      errors.push('ISMRM 2027 permits at most 5 keywords');
    }

    // Check for required ISMRM elements
    if (!abstract.impact || abstract.impact.trim().length === 0) {
      errors.push('Impact statement is required for ISMRM abstracts');
    }

    if (!abstract.synopsis || abstract.synopsis.trim().length === 0) {
      errors.push('Synopsis is required for ISMRM abstracts');
    }

    // Check for MRI-related content
    if (abstract.abstract) {
      const content = abstract.abstract.toLowerCase();
      const mriTerms = ['mri', 'magnetic resonance', 'mr imaging', 'nmr'];
      const hasMRIContent = mriTerms.some((term) => content.includes(term));

      if (!hasMRIContent) {
        warnings.push('Abstract may not contain sufficient MRI-related content for ISMRM');
      }
    }

    // Check categories for ISMRM relevance
    if (abstract.categories && abstract.categories.length > 0) {
      const ismrmCategories = this.getCategories().map((cat) => cat.name.toLowerCase());
      const hasRelevantCategory = abstract.categories.some((cat) =>
        ismrmCategories.includes(cat.name.toLowerCase())
      );

      if (!hasRelevantCategory) {
        warnings.push('Consider adding ISMRM-relevant categories');
      }
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * Get ISMRM display name
   */
  getDisplayName(): string {
    return 'ISMRM Abstract Assistant';
  }
}
