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
 * JACC Conference Module
 * Handles JACC-specific abstract generation and validation
 */
export class JACCModule extends BaseConferenceModule {
  readonly id: Conference = 'JACC';
  readonly name: string = 'JACC Cardiovascular';
  readonly submissionUrl: string = 'https://www.jacc.org/author-center';
  
  readonly guidelines: ConferenceGuidelines = {
    abstractTypes: [
      'JACC Scientific Abstract'
    ],
    wordLimits: {
      abstract: 250,
      impact: 40,
      synopsis: 80
    },
    requiredSections: ['background', 'methods', 'results', 'conclusions'],
    formattingRules: [
      'Use structured format with Background, Methods, Results, Conclusions',
      'Focus on cardiovascular clinical relevance',
      'Include patient population and statistical methods'
    ]
  };

  readonly abstractTypes: AbstractType[] = [
    'JACC Scientific Abstract'
  ];

  /**
   * JACC has conference-specific generation methods
   */
  protected hasConferenceSpecificGeneration(): boolean {
    return true;
  }

  /**
   * Generate JACC-specific abstract
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
          'JACC'
        );
      } else {
        // Fallback to generic generation with JACC-specific prompting
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
      throw new Error(`JACC abstract generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get JACC-specific categories
   */
  getCategories(): Category[] {
    return [
      { name: 'Coronary Artery Disease', type: 'main', probability: 1.0 },
      { name: 'Heart Failure', type: 'main', probability: 1.0 },
      { name: 'Arrhythmias', type: 'main', probability: 1.0 },
      { name: 'Valvular Disease', type: 'main', probability: 1.0 },
      { name: 'Hypertension', type: 'main', probability: 1.0 },
      { name: 'Interventional Cardiology', type: 'sub', probability: 1.0 },
      { name: 'Electrophysiology', type: 'sub', probability: 1.0 },
      { name: 'Cardiac Surgery', type: 'sub', probability: 1.0 },
      { name: 'Preventive Cardiology', type: 'sub', probability: 1.0 },
      { name: 'Echocardiography', type: 'secondary', probability: 1.0 },
      { name: 'Cardiac MRI', type: 'secondary', probability: 1.0 },
      { name: 'Nuclear Cardiology', type: 'secondary', probability: 1.0 }
    ];
  }

  /**
   * Get JACC-specific keywords
   */
  getKeywords(): string[] {
    return [
      'Cardiovascular', 'Cardiology', 'Heart Disease', 'Coronary',
      'Myocardial Infarction', 'Heart Failure', 'Arrhythmia', 'Atrial Fibrillation',
      'Echocardiography', 'Cardiac Catheterization', 'PCI', 'Stent',
      'Ejection Fraction', 'Biomarkers', 'Troponin', 'BNP', 'NT-proBNP',
      'Cardiovascular Risk', 'Mortality', 'Morbidity', 'Clinical Outcomes',
      'Randomized Trial', 'Meta-analysis', 'Cohort Study'
    ];
  }

  /**
   * JACC-specific validation
   */
  protected validateConferenceSpecific(abstract: AbstractData): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check for JACC structured format
    if (abstract.abstract) {
      const content = abstract.abstract.toLowerCase();
      const requiredSections = ['background', 'method', 'result', 'conclusion'];
      const missingSections = requiredSections.filter(section => 
        !content.includes(section) && !content.includes(section + 's')
      );
      
      if (missingSections.length > 0) {
        warnings.push(`Consider including these sections: ${missingSections.join(', ')}`);
      }
    }

    // Check for cardiovascular-related content
    if (abstract.abstract) {
      const content = abstract.abstract.toLowerCase();
      const cardioTerms = ['cardiovascular', 'cardiac', 'heart', 'coronary', 'myocardial', 'cardiology'];
      const hasCardioContent = cardioTerms.some(term => content.includes(term));
      
      if (!hasCardioContent) {
        warnings.push('Abstract may not contain sufficient cardiovascular content for JACC');
      }
    }

    // Check for clinical relevance
    if (abstract.abstract) {
      const content = abstract.abstract.toLowerCase();
      const clinicalTerms = ['patient', 'clinical', 'treatment', 'therapy', 'outcome', 'mortality', 'morbidity'];
      const hasClinicalContent = clinicalTerms.some(term => content.includes(term));
      
      if (!hasClinicalContent) {
        warnings.push('Consider emphasizing clinical relevance and patient outcomes');
      }
    }

    // Check for statistical methods
    if (abstract.abstract) {
      const content = abstract.abstract.toLowerCase();
      const statsTerms = ['statistical', 'p-value', 'confidence interval', 'hazard ratio', 'odds ratio'];
      const hasStats = statsTerms.some(term => content.includes(term));
      
      if (!hasStats) {
        warnings.push('Consider including statistical methods and results');
      }
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * Get JACC display name
   */
  getDisplayName(): string {
    return 'JACC Cardiovascular';
  }
}