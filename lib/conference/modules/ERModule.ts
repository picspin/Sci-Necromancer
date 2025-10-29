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
 * ER (European Radiology) Conference Module
 * Handles ER-specific abstract generation and validation
 */
export class ERModule extends BaseConferenceModule {
  readonly id: Conference = 'ER';
  readonly name: string = 'European Radiology';
  readonly submissionUrl: string = 'https://www.myesr.org/publications/';
  
  readonly guidelines: ConferenceGuidelines = {
    abstractTypes: [
      'ER Scientific Abstract'
    ],
    wordLimits: {
      abstract: 300,
      impact: 50,
      synopsis: 100
    },
    requiredSections: ['objectives', 'methods', 'results', 'conclusion'],
    formattingRules: [
      'Use structured format with Objectives, Methods, Results, Conclusion',
      'Follow European radiology standards and terminology',
      'Include ethical approval information where applicable'
    ]
  };

  readonly abstractTypes: AbstractType[] = [
    'ER Scientific Abstract'
  ];

  /**
   * ER has conference-specific generation methods
   */
  protected hasConferenceSpecificGeneration(): boolean {
    return true;
  }

  /**
   * Generate ER-specific abstract
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
          'ER'
        );
      } else {
        // Fallback to generic generation with ER-specific prompting
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
      throw new Error(`ER abstract generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get ER-specific categories
   */
  getCategories(): Category[] {
    return [
      { name: 'Chest Radiology', type: 'main', probability: 1.0 },
      { name: 'Abdominal Radiology', type: 'main', probability: 1.0 },
      { name: 'Neuroradiology', type: 'main', probability: 1.0 },
      { name: 'Musculoskeletal Radiology', type: 'main', probability: 1.0 },
      { name: 'Breast Imaging', type: 'main', probability: 1.0 },
      { name: 'Interventional Radiology', type: 'sub', probability: 1.0 },
      { name: 'Pediatric Radiology', type: 'sub', probability: 1.0 },
      { name: 'Emergency Radiology', type: 'sub', probability: 1.0 },
      { name: 'Oncologic Imaging', type: 'sub', probability: 1.0 },
      { name: 'CT', type: 'secondary', probability: 1.0 },
      { name: 'MRI', type: 'secondary', probability: 1.0 },
      { name: 'Ultrasound', type: 'secondary', probability: 1.0 },
      { name: 'Nuclear Medicine', type: 'secondary', probability: 1.0 }
    ];
  }

  /**
   * Get ER-specific keywords
   */
  getKeywords(): string[] {
    return [
      'Radiology', 'Medical Imaging', 'CT', 'MRI', 'Ultrasound',
      'X-ray', 'Mammography', 'Nuclear Medicine', 'PET/CT', 'SPECT',
      'Interventional Radiology', 'Image-guided Therapy',
      'Artificial Intelligence', 'Machine Learning', 'Radiomics',
      'Computer-aided Diagnosis', 'Image Analysis', 'Quantitative Imaging',
      'Contrast Media', 'Radiation Protection', 'Image Quality',
      'Diagnostic Performance', 'Inter-observer Agreement', 'Reproducibility'
    ];
  }

  /**
   * ER-specific validation
   */
  protected validateConferenceSpecific(abstract: AbstractData): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check for ER structured format
    if (abstract.abstract) {
      const content = abstract.abstract.toLowerCase();
      const requiredSections = ['objective', 'method', 'result', 'conclusion'];
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
      const radiologyTerms = ['radiology', 'imaging', 'ct', 'mri', 'ultrasound', 'x-ray', 'radiologic'];
      const hasRadiologyContent = radiologyTerms.some(term => content.includes(term));
      
      if (!hasRadiologyContent) {
        warnings.push('Abstract may not contain sufficient radiology-related content for European Radiology');
      }
    }

    // Check for European standards compliance
    if (abstract.abstract) {
      const content = abstract.abstract.toLowerCase();
      const europeanTerms = ['european', 'ethics', 'gdpr', 'consent', 'approval'];
      const hasEuropeanContext = europeanTerms.some(term => content.includes(term));
      
      if (!hasEuropeanContext) {
        warnings.push('Consider mentioning ethical approval or European regulatory compliance');
      }
    }

    // Check for quantitative results
    if (abstract.abstract) {
      const content = abstract.abstract.toLowerCase();
      const quantTerms = ['sensitivity', 'specificity', 'accuracy', 'auc', 'confidence interval', 'p-value'];
      const hasQuantResults = quantTerms.some(term => content.includes(term));
      
      if (!hasQuantResults) {
        warnings.push('Consider including quantitative diagnostic performance metrics');
      }
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * Get ER display name
   */
  getDisplayName(): string {
    return 'European Radiology';
  }

  /**
   * ER module is available (placeholder for future implementation status)
   */
  isAvailable(): boolean {
    return true; // Set to false if module is not yet fully implemented
  }
}