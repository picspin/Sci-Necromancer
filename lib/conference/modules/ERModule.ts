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
import { GuidelineService } from '../GuidelineService';
import * as llm from '../../llm';

/**
 * Research type definitions with EQUATOR Network reporting guidelines
 */
export interface ResearchTypeGuideline {
  type: string;
  checklist: string;
  checklistUrl: string;
  alternativeUrl: string;
  description: string;
}

export const ECR_RESEARCH_TYPES: ResearchTypeGuideline[] = [
  {
    type: 'Case-control study',
    checklist: 'STROBE',
    checklistUrl: 'https://www.equator-network.org/reporting-guidelines/strobe/',
    alternativeUrl: 'https://pubmed.ncbi.nlm.nih.gov/18064739/',
    description: 'Compares subjects with a condition to those without',
  },
  {
    type: 'Cross-sectional study',
    checklist: 'STROBE',
    checklistUrl: 'https://www.equator-network.org/reporting-guidelines/strobe/',
    alternativeUrl: 'https://pubmed.ncbi.nlm.nih.gov/18064739/',
    description: 'Observational study at a single point in time',
  },
  {
    type: 'Diagnostic or prognostic study',
    checklist: 'STARD',
    checklistUrl: 'https://www.equator-network.org/reporting-guidelines/stard/',
    alternativeUrl: 'https://pubmed.ncbi.nlm.nih.gov/26511519/',
    description: 'Evaluates diagnostic accuracy or prognostic value',
  },
  {
    type: 'Experimental (animal study)',
    checklist: 'ARRIVE',
    checklistUrl: 'https://www.equator-network.org/reporting-guidelines/arrive/',
    alternativeUrl: 'https://pubmed.ncbi.nlm.nih.gov/32663219/',
    description: 'Animal research and preclinical studies',
  },
  {
    type: 'Observational study',
    checklist: 'STROBE',
    checklistUrl: 'https://www.equator-network.org/reporting-guidelines/strobe/',
    alternativeUrl: 'https://pubmed.ncbi.nlm.nih.gov/18064739/',
    description: 'Cohort, case-control, or cross-sectional design',
  },
  {
    type: 'Randomised controlled trial',
    checklist: 'CONSORT',
    checklistUrl: 'https://www.equator-network.org/reporting-guidelines/consort/',
    alternativeUrl: 'https://pubmed.ncbi.nlm.nih.gov/20332509/',
    description: 'Randomised experimental study with control group',
  },
];

/**
 * ER (European Congress of Radiology / ECR) Module
 * Handles ECR-specific abstract generation and validation
 *
 * ECR is one of the world's largest radiological meetings, organized by the
 * European Society of Radiology (ESR).
 */
export class ERModule extends BaseConferenceModule {
  readonly id: Conference = 'ER';
  readonly name: string = 'ECR';
  readonly submissionUrl: string = 'https://www.myesr.org/abstractsubmission';

  readonly guidelines: ConferenceGuidelines = {
    abstractTypes: [
      'ECR Research Presentation',
      'ECR Clinical Trials in Radiology',
      'ECR EPOS Scientific Poster',
      'ECR EPOS Educational Poster',
      'ECR Student Presentation',
    ],
    wordLimits: {
      abstract: 280,
      impact: 50,
      synopsis: 100,
      title: 200, // characters
    },
    requiredSections: [
      'PURPOSE or LEARNING OBJECTIVE',
      'METHODS or BACKGROUND',
      'RESULTS or FINDINGS',
      'CONCLUSIONS',
      'LIMITATIONS',
      'FUNDING for this study',
    ],
    formattingRules: [
      'Maximum 280 words for abstract body',
      'Title: no full stop at end, no trade names or special symbols',
      'Use British English spelling throughout (tumour, centre, analyse, colour, randomised)',
      'Numbers < 10 spelled out; numbers >= 10 written numerically',
      'Each section must be a complete paragraph ending with full stop',
      'Maximum 9 authors; up to 10 images for posters only',
      'Up to 3 keywords per column; one per category mandatory',
      'Declare conflicts of interest for all authors',
      'Include ethics approval information where applicable',
      'LIMITATIONS section mandatory for research abstracts',
      'FUNDING section mandatory - state "No funding was received" if none',
    ],
  };

  // Cached guideline content
  private guidelineContent: string | null = null;

  readonly abstractTypes: AbstractType[] = [
    'ECR Research Presentation',
    'ECR Clinical Trials in Radiology',
    'ECR EPOS Scientific Poster',
    'ECR EPOS Educational Poster',
    'ECR Student Presentation',
  ];

  /**
   * ER/ECR has conference-specific generation methods
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
      this.guidelineContent = await GuidelineService.loadGuideline('ER');
      return this.guidelineContent;
    } catch (error) {
      console.warn('Failed to load ECR guideline, using embedded version:', error);
      return this.getEmbeddedGuideline();
    }
  }

  /**
   * Get embedded guideline as fallback
   */
  private getEmbeddedGuideline(): string {
    return `ECR Abstract Submission Guidelines:
- Maximum 280 words for abstract body
- Structured format: Purpose/Objectives, Methods/Materials, Results, Conclusions
- British English spelling required
- Title: max 200 characters, no full stop at end, no trade names
- Numbers < 10 spelled out; >= 10 written numerically
- Dates in British format (day.month.year)
- Maximum 9 authors; up to 10 images for posters
- Include ethics approval and funding information where applicable
- Consult EQUATOR Network guidelines for your study type (STROBE, STARD, ARRIVE, CONSORT)`;
  }

  /**
   * Get EQUATOR Network research type guidelines
   */
  getResearchTypeGuidelines(): ResearchTypeGuideline[] {
    return ECR_RESEARCH_TYPES;
  }

  /**
   * Get guideline for specific research type
   */
  getGuidelineForResearchType(researchType: string): ResearchTypeGuideline | undefined {
    return ECR_RESEARCH_TYPES.find((rt) => rt.type.toLowerCase() === researchType.toLowerCase());
  }

  /**
   * Generate ECR-specific abstract
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
          'ER',
          guideline
        );
      } else {
        // Fallback to generic generation with ECR-specific prompting
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
        `ECR abstract generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get ECR-specific categories based on ECR Congress topics
   */
  getCategories(): Category[] {
    return [
      // Main Topics - Organ Systems
      { name: 'Abdominal Viscera', type: 'main', probability: 1.0 },
      { name: 'Breast', type: 'main', probability: 1.0 },
      { name: 'Cardiac', type: 'main', probability: 1.0 },
      { name: 'Chest', type: 'main', probability: 1.0 },
      { name: 'Head and Neck', type: 'main', probability: 1.0 },
      { name: 'Musculoskeletal', type: 'main', probability: 1.0 },
      { name: 'Neuro', type: 'main', probability: 1.0 },
      { name: 'Oncologic Imaging', type: 'main', probability: 1.0 },
      { name: 'Paediatric', type: 'main', probability: 1.0 },
      { name: 'Urogenital', type: 'main', probability: 1.0 },
      { name: 'Vascular', type: 'main', probability: 1.0 },
      // Sub Topics - Modalities
      { name: 'CT', type: 'sub', probability: 1.0 },
      { name: 'MRI', type: 'sub', probability: 1.0 },
      { name: 'Ultrasound', type: 'sub', probability: 1.0 },
      { name: 'Conventional Radiography', type: 'sub', probability: 1.0 },
      { name: 'Mammography', type: 'sub', probability: 1.0 },
      { name: 'Fluoroscopy', type: 'sub', probability: 1.0 },
      { name: 'Hybrid Imaging (PET/CT, PET/MRI, SPECT/CT)', type: 'sub', probability: 1.0 },
      // Secondary Topics - Techniques/Applications
      { name: 'Artificial Intelligence/Machine Learning', type: 'secondary', probability: 1.0 },
      { name: 'Contrast Media', type: 'secondary', probability: 1.0 },
      { name: 'Emergency Radiology', type: 'secondary', probability: 1.0 },
      { name: 'Image-Guided Interventions', type: 'secondary', probability: 1.0 },
      { name: 'Radiation Protection/Radioprotection', type: 'secondary', probability: 1.0 },
      { name: 'Radiomics/Quantitative Imaging', type: 'secondary', probability: 1.0 },
      { name: 'Sustainability in Radiology', type: 'secondary', probability: 1.0 },
      { name: 'Education and Training', type: 'secondary', probability: 1.0 },
    ];
  }

  /**
   * Get ECR-specific keywords
   */
  getKeywords(): string[] {
    return [
      // Modalities
      'CT',
      'MRI',
      'Ultrasound',
      'X-ray',
      'Mammography',
      'PET/CT',
      'PET/MRI',
      'SPECT/CT',
      'Fluoroscopy',
      // Techniques
      'Artificial Intelligence',
      'Machine Learning',
      'Deep Learning',
      'Radiomics',
      'Texture Analysis',
      'Computer-Aided Detection',
      'Computer-Aided Diagnosis',
      'Quantitative Imaging',
      'Dual-Energy CT',
      'Diffusion-Weighted Imaging',
      'Perfusion Imaging',
      'Contrast-Enhanced',
      // Interventional
      'Interventional Radiology',
      'Image-Guided Biopsy',
      'Ablation',
      'Embolisation',
      // Quality & Safety
      'Radiation Dose',
      'Radiation Protection',
      'Image Quality',
      'Quality Assurance',
      'Patient Safety',
      'Sustainability',
      // Clinical
      'Diagnostic Accuracy',
      'Sensitivity',
      'Specificity',
      'Staging',
      'Screening',
      'Follow-up',
      // Study Types (aligned with EQUATOR)
      'Cohort Study',
      'Case-Control Study',
      'Cross-Sectional Study',
      'Randomised Controlled Trial',
      'Diagnostic Accuracy Study',
      'Prognostic Study',
      'Meta-Analysis',
      'Systematic Review',
    ];
  }

  /**
   * ECR-specific validation
   */
  protected validateConferenceSpecific(abstract: AbstractData): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check word limit (280 words)
    if (abstract.abstract) {
      const wordCount = abstract.abstract.split(/\s+/).filter((w) => w.length > 0).length;
      if (wordCount > 280) {
        errors.push(`Abstract exceeds word limit: ${wordCount}/280 words`);
      } else if (wordCount > 250) {
        warnings.push(`Abstract is close to word limit: ${wordCount}/280 words`);
      }
    }

    // Check for ECR structured format
    if (abstract.abstract) {
      const content = abstract.abstract.toLowerCase();
      const requiredSections = ['purpose', 'method', 'result', 'conclusion'];
      const missingSections = requiredSections.filter(
        (section) => !content.includes(section) && !content.includes(section + 's')
      );

      if (missingSections.length > 0) {
        warnings.push(`Consider including these sections: ${missingSections.join(', ')}`);
      }
    }

    // Check for radiology-related content
    if (abstract.abstract) {
      const content = abstract.abstract.toLowerCase();
      const radiologyTerms = [
        'radiology',
        'imaging',
        'ct',
        'mri',
        'ultrasound',
        'x-ray',
        'radiologic',
        'radiograph',
        'scan',
      ];
      const hasRadiologyContent = radiologyTerms.some((term) => content.includes(term));

      if (!hasRadiologyContent) {
        warnings.push('Abstract may not contain sufficient radiology-related content for ECR');
      }
    }

    // Check for British English spelling (common differences)
    if (abstract.abstract) {
      const americanSpellings = [
        { american: 'tumor', british: 'tumour' },
        { american: 'color', british: 'colour' },
        { american: 'center', british: 'centre' },
        { american: 'analyze', british: 'analyse' },
        { american: 'optimize', british: 'optimise' },
        { american: 'utilize', british: 'utilise' },
        { american: 'randomized', british: 'randomised' },
        { american: 'characterized', british: 'characterised' },
        { american: 'hemorrhage', british: 'haemorrhage' },
        { american: 'anemia', british: 'anaemia' },
        { american: 'pediatric', british: 'paediatric' },
        { american: 'fetal', british: 'foetal' },
      ];

      const contentLower = abstract.abstract.toLowerCase();
      const americanFound = americanSpellings.filter((s) => contentLower.includes(s.american));

      if (americanFound.length > 0) {
        const suggestions = americanFound.map((s) => `${s.american} -> ${s.british}`).join(', ');
        warnings.push(`ECR requires British English spelling. Consider: ${suggestions}`);
      }
    }

    // Check for prohibited content (trade names, symbols)
    if (abstract.abstract) {
      if (
        abstract.abstract.includes('®') ||
        abstract.abstract.includes('™') ||
        abstract.abstract.includes('©')
      ) {
        errors.push('Trade symbols (®, ™, ©) are not allowed in ECR abstracts');
      }
    }

    // Check title formatting
    if (abstract.title) {
      if (abstract.title.endsWith('.')) {
        errors.push('Title should not end with a full stop');
      }
      if (abstract.title.length > 200) {
        errors.push(`Title exceeds character limit: ${abstract.title.length}/200 characters`);
      }
    }

    // Check for ethics/funding information mention
    if (abstract.abstract) {
      const content = abstract.abstract.toLowerCase();
      const hasEthicsInfo =
        content.includes('ethics') ||
        content.includes('ethical') ||
        content.includes('irb') ||
        content.includes('institutional review');
      const hasFundingInfo =
        content.includes('funding') ||
        content.includes('grant') ||
        content.includes('supported by');

      if (!hasEthicsInfo) {
        warnings.push(
          'Consider including ethics approval information (required for clinical studies)'
        );
      }
      if (!hasFundingInfo) {
        warnings.push(
          'Consider including funding information or stating "No funding was received"'
        );
      }
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * Get ECR color scheme (ESR blue)
   */
  getColorScheme(): { primary: string; secondary: string; accent: string } {
    return {
      primary: '#003366', // ESR dark blue
      secondary: '#0066CC',
      accent: '#00AAFF',
    };
  }

  /**
   * Get ECR display name
   */
  getDisplayName(): string {
    return 'ECR';
  }

  /**
   * ECR module is available
   */
  isAvailable(): boolean {
    return true;
  }
}
