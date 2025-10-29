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
 * RSNA Conference Module
 * Handles RSNA-specific abstract generation and validation
 */
export class RSNAModule extends BaseConferenceModule {
  readonly id: Conference = 'RSNA';
  readonly name: string = 'RSNA Radiology';
  readonly submissionUrl: string = 'https://mc.manuscriptcentral.com/rad';
  
  readonly guidelines: ConferenceGuidelines = {
    abstractTypes: [
      'RSNA Scientific Abstract'
    ],
    wordLimits: {
      abstract: 300,
      impact: 50,
      synopsis: 100
    },
    requiredSections: ['purpose', 'methods', 'results', 'conclusion'],
    formattingRules: [
      'Use structured format with Purpose, Methods, Results, Conclusion',
      'Include statistical analysis where appropriate',
      'Follow RSNA scientific abstract guidelines'
    ]
  };

  readonly abstractTypes: AbstractType[] = [
    'RSNA Scientific Abstract'
  ];

  /**
   * RSNA has conference-specific generation methods
   */
  protected hasConferenceSpecificGeneration(): boolean {
    return true;
  }

  /**
   * Generate RSNA-specific abstract
   */
  protected async generateConferenceSpecificAbstract(params: AbstractGenerationParams): Promise<AbstractData> {
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
      throw new Error(`RSNA abstract generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get RSNA-specific categories
   */
  getCategories(): Category[] {
    return [
      { name: 'Chest Imaging', type: 'main', probability: 1.0 },
      { name: 'Abdominal Imaging', type: 'main', probability: 1.0 },
      { name: 'Neuroradiology', type: 'main', probability: 1.0 },
      { name: 'Musculoskeletal Imaging', type: 'main', probability: 1.0 },
      { name: 'Breast Imaging', type: 'main', probability: 1.0 },
      { name: 'Interventional Radiology', type: 'sub', probability: 1.0 },
      { name: 'Nuclear Medicine', type: 'sub', probability: 1.0 },
      { name: 'Ultrasound', type: 'sub', probability: 1.0 },
      { name: 'CT', type: 'secondary', probability: 1.0 },
      { name: 'MRI', type: 'secondary', probability: 1.0 },
      { name: 'PET/CT', type: 'secondary', probability: 1.0 },
      { name: 'Mammography', type: 'secondary', probability: 1.0 }
    ];
  }

  /**
   * Get RSNA-specific keywords
   */
  getKeywords(): string[] {
    return [
      'CT', 'MRI', 'Ultrasound', 'X-ray', 'Mammography', 'PET/CT',
      'Interventional Radiology', 'Nuclear Medicine', 'Radiomics',
      'Artificial Intelligence', 'Machine Learning', 'Deep Learning',
      'Image Analysis', 'Computer-Aided Detection', 'Quantitative Imaging',
      'Contrast Enhancement', 'Radiation Dose', 'Image Quality',
      'Diagnostic Accuracy', 'Sensitivity', 'Specificity', 'ROC Analysis'
    ];
  }

  /**
   * RSNA-specific validation
   */
  protected validateConferenceSpecific(abstract: AbstractData): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check for RSNA structured format
    if (abstract.abstract) {
      const content = abstract.abstract.toLowerCase();
      const requiredSections = ['purpose', 'method', 'result', 'conclusion'];
      const missingSections = requiredSections.filter(section => 
        !content.includes(section) && !content.includes(section + 's')
      );
      
      if (missingSections.length > 0) {
        warnings.push(`Consider including these sections: ${missingSections.join(', ')}`);
      }
    }

    // Check for radiology-related content
    if (abstract.abstract) {
      const content = abstract.abstract.toLowerCase();
      const radiologyTerms = ['ct', 'mri', 'ultrasound', 'x-ray', 'imaging', 'radiology', 'radiologic'];
      const hasRadiologyContent = radiologyTerms.some(term => content.includes(term));
      
      if (!hasRadiologyContent) {
        warnings.push('Abstract may not contain sufficient radiology-related content for RSNA');
      }
    }

    // Check for statistical analysis mention
    if (abstract.abstract) {
      const content = abstract.abstract.toLowerCase();
      const statsTerms = ['statistical', 'p-value', 'confidence interval', 'significance', 'analysis'];
      const hasStats = statsTerms.some(term => content.includes(term));
      
      if (!hasStats) {
        warnings.push('Consider including statistical analysis information');
      }
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * Get RSNA display name
   */
  getDisplayName(): string {
    return 'RSNA Radiology';
  }
}