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
import { GuidelineService } from '../GuidelineService';

/**
 * ESC (European Society of Cardiology) Congress Module
 * Handles ESC-specific abstract generation and validation
 */
export class ESCModule extends BaseConferenceModule {
  readonly id: Conference = 'ESC';
  readonly name: string = 'ESC Congress';
  readonly submissionUrl: string = 'https://escol.escardio.org/';

  readonly guidelines: ConferenceGuidelines = {
    abstractTypes: ['ESC Scientific Abstract', 'ESC Young Investigator Award'],
    wordLimits: {
      abstract: 3000, // 3000 characters (~500 words)
      impact: 40,
      synopsis: 100,
      title: 200, // 200 characters
    },
    requiredSections: ['background', 'purpose', 'methods', 'results', 'conclusions'],
    formattingRules: [
      'Maximum 3000 characters including spaces for abstract body',
      'Title maximum 200 characters in lowercase except abbreviations',
      'Up to 2 JPEG images allowed (max 2MB each, 1920x1080 pixels)',
      'Use structured format: Background/Introduction, Purpose, Methods, Results, Conclusion(s)',
      'Do not include author names, institutions, or cities in abstract text',
      'Use generic drug names, not commercial/brand names',
      'Abstracts must be in English with UK spelling',
      'No QR codes, trademarks, or commercial names allowed',
    ],
  };

  readonly abstractTypes: AbstractType[] = [
    'ESC Scientific Abstract',
    'ESC Young Investigator Award',
  ];

  /** ESC remains visible in navigation but is intentionally not released yet. */
  isAvailable(): boolean {
    return false;
  }

  // Cached guideline content
  private guidelineContent: string | null = null;

  /**
   * ESC has conference-specific generation methods
   */
  protected hasConferenceSpecificGeneration(): boolean {
    return true;
  }

  /**
   * Load guideline from file or database (async)
   */
  async loadGuideline(): Promise<string> {
    if (this.guidelineContent) {
      return this.guidelineContent;
    }

    try {
      // Try to load from GuidelineService (supports database or file fallback)
      this.guidelineContent = await GuidelineService.loadGuideline('ESC');
      return this.guidelineContent;
    } catch (error) {
      console.warn('Failed to load ESC guideline, using embedded version:', error);
      // Fallback to embedded basic guideline
      return this.getEmbeddedGuideline();
    }
  }

  /**
   * Get embedded guideline as fallback
   */
  private getEmbeddedGuideline(): string {
    return `ESC Congress Abstract Submission Guidelines:
- Maximum 3000 characters for abstract body
- Structured format: Background, Purpose, Methods, Results, Conclusions
- Title maximum 200 characters
- Up to 2 JPEG images (max 2MB, 1920x1080px)
- No identifying information (authors, institutions, cities)
- Use generic drug names only
- English with UK spelling required`;
  }

  /**
   * Generate ESC-specific abstract
   */
  protected async generateConferenceSpecificAbstract(
    params: AbstractGenerationParams
  ): Promise<AbstractData> {
    try {
      // Load guideline for context
      const guideline = await this.loadGuideline();

      // Check if conference-specific LLM methods exist
      if (typeof llm.generateAbstractForConference === 'function') {
        return await llm.generateAbstractForConference(
          params.inputText,
          params.abstractType,
          params.categories,
          params.keywords,
          'ESC',
          guideline
        );
      } else {
        // Fallback to generic generation with ESC-specific prompting
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
        `ESC abstract generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get ESC-specific categories based on ESC Congress topics
   */
  getCategories(): Category[] {
    return [
      // Main Topics
      { name: 'Arrhythmias, Pacing and Electrophysiology', type: 'main', probability: 1.0 },
      { name: 'Heart Failure and Cardiomyopathies', type: 'main', probability: 1.0 },
      { name: 'Coronary Artery Disease, Acute Coronary Syndromes', type: 'main', probability: 1.0 },
      { name: 'Valvular Heart Disease', type: 'main', probability: 1.0 },
      { name: 'Cardiovascular Imaging', type: 'main', probability: 1.0 },
      { name: 'Preventive Cardiology', type: 'main', probability: 1.0 },
      { name: 'Interventional Cardiology', type: 'main', probability: 1.0 },
      // Sub Topics
      { name: 'Artificial Intelligence in Cardiology', type: 'sub', probability: 1.0 },
      { name: 'Basic and Translational Sciences', type: 'sub', probability: 1.0 },
      { name: 'Cardiovascular Disease in Women', type: 'sub', probability: 1.0 },
      { name: 'Population Science, Genetics and Epidemiology', type: 'sub', probability: 1.0 },
      // Secondary Topics
      { name: 'Hypertension', type: 'secondary', probability: 1.0 },
      { name: 'Aortic and Peripheral Vascular Disease', type: 'secondary', probability: 1.0 },
      { name: 'Congenital Heart Disease', type: 'secondary', probability: 1.0 },
      { name: 'Cardiac Surgery', type: 'secondary', probability: 1.0 },
    ];
  }

  /**
   * Get ESC-specific keywords
   */
  getKeywords(): string[] {
    return [
      // Clinical Terms
      'Cardiovascular',
      'Cardiology',
      'Heart Disease',
      'Coronary',
      'Myocardial Infarction',
      'Heart Failure',
      'Arrhythmia',
      'Atrial Fibrillation',
      'Ventricular Tachycardia',
      // Imaging
      'Echocardiography',
      'Cardiac MRI',
      'CT Angiography',
      'Nuclear Cardiology',
      // Interventions
      'Cardiac Catheterization',
      'PCI',
      'TAVI',
      'Ablation',
      'Pacemaker',
      'ICD',
      // Biomarkers
      'Troponin',
      'BNP',
      'NT-proBNP',
      'Ejection Fraction',
      // Study Types
      'Randomized Trial',
      'Registry',
      'Meta-analysis',
      'Cohort Study',
      // Outcomes
      'Mortality',
      'Morbidity',
      'Clinical Outcomes',
      'Quality of Life',
    ];
  }

  /**
   * ESC-specific validation
   */
  protected validateConferenceSpecific(abstract: AbstractData): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check character limit (3000 characters)
    if (abstract.abstract) {
      const charCount = abstract.abstract.length;
      if (charCount > 3000) {
        errors.push(`Abstract exceeds character limit: ${charCount}/3000 characters`);
      } else if (charCount > 2700) {
        warnings.push(`Abstract is close to character limit: ${charCount}/3000 characters`);
      }
    }

    // Check for ESC structured format
    if (abstract.abstract) {
      const content = abstract.abstract.toLowerCase();
      const requiredSections = ['background', 'purpose', 'method', 'result', 'conclusion'];
      const missingSections = requiredSections.filter(
        (section) => !content.includes(section) && !content.includes(section + 's')
      );

      if (missingSections.length > 0) {
        warnings.push(`Consider including these sections: ${missingSections.join(', ')}`);
      }
    }

    // Check for cardiovascular-related content
    if (abstract.abstract) {
      const content = abstract.abstract.toLowerCase();
      const cardioTerms = [
        'cardiovascular',
        'cardiac',
        'heart',
        'coronary',
        'myocardial',
        'cardiology',
        'arrhythmia',
        'valve',
      ];
      const hasCardioContent = cardioTerms.some((term) => content.includes(term));

      if (!hasCardioContent) {
        warnings.push('Abstract may not contain sufficient cardiovascular content for ESC');
      }
    }

    // Check for prohibited content (identifying information)
    if (abstract.abstract) {
      const content = abstract.abstract.toLowerCase();

      // Check for potential institution names or cities
      const potentialIdentifiers = [
        'university',
        'hospital',
        'clinic',
        'medical center',
        'institute',
      ];
      const hasIdentifiers = potentialIdentifiers.some((term) => content.includes(term));

      if (hasIdentifiers) {
        warnings.push(
          'Abstract may contain institutional names - ESC requires blinded submissions'
        );
      }

      // Check for trademark symbols
      if (content.includes('®') || content.includes('™') || content.includes('©')) {
        errors.push('Trademark and copyright symbols are not allowed in ESC abstracts');
      }
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * Get ESC color scheme (cardiology red)
   */
  getColorScheme(): { primary: string; secondary: string; accent: string } {
    return {
      primary: '#C41E3A', // Cardiology red
      secondary: '#E57373',
      accent: '#8B0000',
    };
  }

  /**
   * Get ESC display name
   */
  getDisplayName(): string {
    return 'ESC Congress';
  }
}
