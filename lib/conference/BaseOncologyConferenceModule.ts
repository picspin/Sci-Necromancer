import type {
  AbstractData,
  AbstractGenerationParams,
  AbstractType,
  Category,
  ConferenceGuidelines,
  OncologySubmissionType,
  ValidationResult,
} from '../../types';
import * as llm from '../llm';
import { BaseConferenceModule } from './BaseConferenceModule';
import {
  getOncologyProfile,
  validateOncologyDraft,
  type OncologyConference,
} from './oncologyRules';

export abstract class BaseOncologyConferenceModule extends BaseConferenceModule {
  abstract readonly id: OncologyConference;
  abstract readonly name: string;
  abstract readonly submissionUrl: string;
  abstract readonly abstractTypes: AbstractType[];
  abstract readonly categories: readonly string[];
  abstract readonly keywords: readonly string[];

  get guidelines(): ConferenceGuidelines {
    const profile = getOncologyProfile(this.id);
    return {
      abstractTypes: this.abstractTypes,
      wordLimits: { abstract: profile.characterLimitExcludingSpaces, impact: 40, synopsis: 100 },
      requiredSections: ['Background', 'Methods', 'Results', 'Conclusions'],
      formattingRules: [
        `${profile.characterLimitExcludingSpaces} characters excluding spaces across title, body, and table`,
        'Do not invent missing scientific facts, statistics, approvals, registrations, or citations',
        'Use the organizer-specific structure for regular, late-breaking, and trial-in-progress submissions',
      ],
    };
  }

  protected override hasConferenceSpecificGeneration(): boolean {
    return true;
  }

  protected override async generateConferenceSpecificAbstract(
    params: AbstractGenerationParams
  ): Promise<AbstractData> {
    const profile = getOncologyProfile(this.id);
    const guidelineContext = [
      profile.ruleVersion,
      ...this.guidelines.formattingRules,
      `Allowed submission types: ${profile.submissionTypes.map((type) => type.id).join(', ')}`,
      'Return unresolved factual gaps as explicit author questions. Never supply plausible missing values.',
    ].join('\n');

    return llm.generateAbstractForConference(
      params.inputText,
      params.abstractType,
      params.categories,
      params.keywords,
      this.id,
      guidelineContext
    );
  }

  override validateAbstract(abstract: AbstractData): ValidationResult {
    const submissionType =
      abstract.oncology?.submissionType ?? this.submissionTypeForAbstract(abstract);
    return validateOncologyDraft({
      conference: this.id,
      submissionType,
      title: abstract.title ?? '',
      body: abstract.abstract ?? '',
      tableText: abstract.oncology?.tableText,
      tableRows: abstract.oncology?.tableRows,
      tableCount: abstract.oncology?.tableCount,
      authorCount: abstract.oncology?.authorCount,
      hasFigures: abstract.oncology?.hasFigures,
      keywords: abstract.keywords,
      presenterIsSponsorEmployee: abstract.oncology?.presenterIsSponsorEmployee,
      containsPatientData: abstract.oncology?.containsPatientData,
      aiGeneratedOrAnalyzedResearchData: abstract.oncology?.aiGeneratedOrAnalyzedResearchData,
      methodsDescribeAI: abstract.oncology?.methodsDescribeAI,
    });
  }

  protected submissionTypeForAbstract(_abstract: AbstractData): OncologySubmissionType {
    return 'regular';
  }

  getCategories(): Category[] {
    return this.categories.map((name) => ({ name, type: 'main', probability: 1 }));
  }

  getKeywords(): string[] {
    return [...this.keywords];
  }

  override isAvailable(): boolean {
    return true;
  }

  protected validateConferenceSpecific(_abstract: AbstractData): ValidationResult {
    return { isValid: true, errors: [], warnings: [] };
  }
}
