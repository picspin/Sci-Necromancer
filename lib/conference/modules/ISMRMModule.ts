import { 
  Conference, 
  ConferenceGuidelines, 
  AbstractType, 
  AbstractData, 
  AbstractGenerationParams, 
  ValidationResult, 
  Category 
} from '../../../types';
import { BaseConferenceModule } from '../BaseConferenceModule';
import * as llm from '../../llm';

/**
 * ISMRM Conference Module
 * Handles ISMRM-specific abstract generation and validation
 */
export class ISMRMModule extends BaseConferenceModule {
  readonly id: Conference = 'ISMRM';
  readonly name: string = 'ISMRM Abstract Assistant';
  readonly submissionUrl: string = 'https://www.ismrm.org/26m/call/';
  
  readonly guidelines: ConferenceGuidelines = {
    abstractTypes: [
      'Standard Abstract',
      'MRI in Clinical Practice Abstract', 
      'ISMRT Abstract',
      'Registered Abstract'
    ],
    wordLimits: {
      abstract: 300,
      impact: 40,
      synopsis: 100
    },
    requiredSections: ['impact', 'synopsis'],
    formattingRules: [
      'Use structured format with clear sections',
      'Include quantitative results where possible',
      'Follow ISMRM submission guidelines'
    ]
  };

  readonly abstractTypes: AbstractType[] = [
    'Standard Abstract',
    'MRI in Clinical Practice Abstract', 
    'ISMRT Abstract',
    'Registered Abstract'
  ];

  /**
   * ISMRM has conference-specific generation methods
   */
  protected hasConferenceSpecificGeneration(): boolean {
    return true;
  }

  /**
   * Generate ISMRM-specific abstract
   */
  protected async generateConferenceSpecificAbstract(params: AbstractGenerationParams): Promise<AbstractData> {
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
      throw new Error(`ISMRM abstract generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get ISMRM-specific categories
   */
  getCategories(): Category[] {
    // These would typically be loaded from a data file or API
    return [
      { name: 'Acquisition Methods', type: 'main', probability: 1.0 },
      { name: 'Image Reconstruction', type: 'main', probability: 1.0 },
      { name: 'Contrast Mechanisms', type: 'main', probability: 1.0 },
      { name: 'Neuro', type: 'sub', probability: 1.0 },
      { name: 'Body', type: 'sub', probability: 1.0 },
      { name: 'Cardiovascular', type: 'sub', probability: 1.0 },
      { name: 'Musculoskeletal', type: 'sub', probability: 1.0 },
      { name: 'Pediatric', type: 'secondary', probability: 1.0 },
      { name: 'Interventional', type: 'secondary', probability: 1.0 }
    ];
  }

  /**
   * Get ISMRM-specific keywords
   */
  getKeywords(): string[] {
    return [
      'MRI', 'fMRI', 'DTI', 'ASL', 'BOLD', 'T1', 'T2', 'FLAIR',
      'Gradient Echo', 'Spin Echo', 'EPI', 'RARE', 'FLASH',
      'Parallel Imaging', 'Compressed Sensing', 'Machine Learning',
      'Deep Learning', 'Reconstruction', 'Artifact Reduction',
      'Motion Correction', 'Quantitative Imaging', 'Biomarkers'
    ];
  }

  /**
   * ISMRM-specific validation
   */
  protected validateConferenceSpecific(abstract: AbstractData): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

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
      const hasMRIContent = mriTerms.some(term => content.includes(term));
      
      if (!hasMRIContent) {
        warnings.push('Abstract may not contain sufficient MRI-related content for ISMRM');
      }
    }

    // Check categories for ISMRM relevance
    if (abstract.categories && abstract.categories.length > 0) {
      const ismrmCategories = this.getCategories().map(cat => cat.name.toLowerCase());
      const hasRelevantCategory = abstract.categories.some(cat => 
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