export type OncologyConference = 'ASCO' | 'ESMO';

export type OncologySubmissionTypeId =
  'regular' | 'lba-shell' | 'lba-intent' | 'lba-final' | 'trial-in-progress';

export interface OncologySubmissionType {
  id: OncologySubmissionTypeId;
  requiredSections: readonly string[];
}

export interface OncologyConferenceProfile {
  id: OncologyConference;
  ruleVersion: string;
  characterLimitExcludingSpaces: number;
  submissionTypes: readonly OncologySubmissionType[];
  presentationPreference: 'organizer-assigned' | 'author-preferred-organizer-final';
}

export interface OncologyDraft {
  conference: OncologyConference;
  submissionType: OncologySubmissionTypeId;
  title: string;
  body: string;
  tableText?: string;
  tableRows?: number;
  tableCount?: number;
  authorCount?: number;
  hasFigures?: boolean;
  keywords: string[];
  presenterIsSponsorEmployee?: boolean;
  containsPatientData?: boolean;
  aiGeneratedOrAnalyzedResearchData?: boolean;
  methodsDescribeAI?: boolean;
}

export interface OncologyValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface OncologyClassificationResult {
  conference: OncologyConference;
  submissionType: OncologySubmissionTypeId;
  primaryCategory: string;
  alternativeCategories: string[];
  studyDesign:
    | 'interventional-trial'
    | 'diagnostic-prognostic'
    | 'biomarker-translational'
    | 'observational-rwe'
    | 'systematic-review-meta-analysis'
    | 'preclinical-basic'
    | 'ai-model-study'
    | 'supportive-policy-nursing'
    | 'trial-in-progress';
  confidence: number;
  rationale: string[];
  warnings: string[];
  ruleVersion: string;
  presentationRecommendation?: 'proffered-paper' | 'rapid-oral' | 'poster' | 'eposter';
}

const ASCO_PROFILE: OncologyConferenceProfile = {
  id: 'ASCO',
  ruleVersion: 'ASCO Annual Meeting 2026',
  characterLimitExcludingSpaces: 2600,
  presentationPreference: 'organizer-assigned',
  submissionTypes: [
    { id: 'regular', requiredSections: ['Background', 'Methods', 'Results', 'Conclusions'] },
    {
      id: 'lba-shell',
      requiredSections: ['Background', 'Methods', 'Primary endpoint', 'Data freeze date'],
    },
    { id: 'lba-final', requiredSections: ['Background', 'Methods', 'Results', 'Conclusions'] },
    { id: 'trial-in-progress', requiredSections: ['Background', 'Methods'] },
  ],
};

const ESMO_PROFILE: OncologyConferenceProfile = {
  id: 'ESMO',
  ruleVersion: 'ESMO Congress 2026',
  characterLimitExcludingSpaces: 2000,
  presentationPreference: 'author-preferred-organizer-final',
  submissionTypes: [
    { id: 'regular', requiredSections: ['Background', 'Methods', 'Results', 'Conclusions'] },
    {
      id: 'lba-intent',
      requiredSections: ['Background', 'Methods', 'Expected results', 'Expected conclusions'],
    },
    { id: 'lba-final', requiredSections: ['Background', 'Methods', 'Results', 'Conclusions'] },
    { id: 'trial-in-progress', requiredSections: ['Background', 'Trial design'] },
  ],
};

export function getOncologyProfile(conference: OncologyConference): OncologyConferenceProfile {
  if (conference === 'ASCO') return ASCO_PROFILE;
  return ESMO_PROFILE;
}

function countCharactersExcludingSpaces(value: string): number {
  return value.replace(/\s/g, '').length;
}

export function validateOncologyDraft(draft: OncologyDraft): OncologyValidationResult {
  const profile = getOncologyProfile(draft.conference);
  const errors: string[] = [];
  const warnings: string[] = [];
  const characterCount = countCharactersExcludingSpaces(
    `${draft.title}${draft.body}${draft.tableText ?? ''}`
  );

  const submissionProfile = profile.submissionTypes.find(
    (submissionType) => submissionType.id === draft.submissionType
  );
  const normalizedBody = draft.body.toLowerCase();
  const missingSections = (submissionProfile?.requiredSections ?? []).filter((section) => {
    const normalizedSection = section.toLowerCase();
    if (normalizedSection === 'results') return !/\bresults?\s*:/.test(normalizedBody);
    if (normalizedSection === 'conclusions') return !/\bconclusions?\s*:/.test(normalizedBody);
    if (normalizedSection === 'methods') {
      return !/\b(methods?|trial design)\s*:/.test(normalizedBody);
    }
    return !normalizedBody.includes(normalizedSection);
  });

  if (missingSections.length) {
    errors.push(`Missing required sections or fields: ${missingSections.join(', ')}.`);
  }
  if (!draft.keywords.length) errors.push('At least one oncology keyword is required.');

  if (characterCount > profile.characterLimitExcludingSpaces) {
    errors.push(
      `Title, body, and table exceed the ${profile.characterLimitExcludingSpaces}-character limit excluding spaces (${characterCount}/${profile.characterLimitExcludingSpaces}).`
    );
  }

  if (
    draft.submissionType === 'trial-in-progress' &&
    /\b(results?|outcomes?|response rate|survival|hazard ratio|odds ratio)\s*:/i.test(draft.body)
  ) {
    errors.push('Trial-in-progress abstracts must not include results or preliminary data.');
  }

  if (/\bcase report\b/i.test(`${draft.title} ${draft.body}`)) {
    errors.push('Case reports are not eligible for this oncology conference pathway.');
  }
  if (draft.hasFigures) {
    errors.push('Figures are not allowed in the abstract submission.');
  }

  if (draft.conference === 'ASCO') {
    if ((draft.tableCount ?? (draft.tableText ? 1 : 0)) > 1) {
      errors.push('ASCO abstracts may include at most one table.');
    }
    if ((draft.tableRows ?? 0) > 10) {
      errors.push('The ASCO table may include no more than 10 rows.');
    }
  }

  if (draft.conference === 'ESMO') {
    if ((draft.tableCount ?? (draft.tableText ? 1 : 0)) > 1) {
      errors.push('ESMO abstracts may include at most one table.');
    }
    if ((draft.tableText?.length ?? 0) > 600) {
      errors.push('The ESMO table must not exceed 600 characters.');
    }
    if ((draft.authorCount ?? 0) > 20) {
      errors.push('ESMO abstracts may list no more than 20 authors.');
    }
    if (draft.containsPatientData && draft.presenterIsSponsorEmployee) {
      errors.push(
        'Clinical or translational patient-data abstracts require an independent practicing physician or investigator as presenter.'
      );
    }
    if (draft.aiGeneratedOrAnalyzedResearchData && !draft.methodsDescribeAI) {
      errors.push(
        'AI use must be described in Methods when AI generated or analyzed research data.'
      );
    }
  }

  return { isValid: errors.length === 0, errors, warnings };
}

export function classifyOncologyAbstract(
  conference: OncologyConference,
  inputText: string
): OncologyClassificationResult {
  const text = inputText.toLowerCase();
  const profile = getOncologyProfile(conference);
  const trialInProgress =
    /\b(trial in progress|ongoing|currently recruiting|recruitment (?:is )?(?:open|ongoing))\b/.test(
      text
    ) && !/\b(results?|outcomes?)\s*:\s*(?!not available|none|pending)/.test(text);
  const lateBreaking = /\b(late[- ]breaking|lba)\b/.test(text);
  const hasResults = /\b(results?|outcomes?)\s*:\s*(?!not available|none|pending)/.test(text);

  const submissionType: OncologySubmissionTypeId = trialInProgress
    ? 'trial-in-progress'
    : lateBreaking && !hasResults
      ? conference === 'ASCO'
        ? 'lba-shell'
        : 'lba-intent'
      : lateBreaking
        ? 'lba-final'
        : 'regular';

  const isAI = /\b(artificial intelligence|machine learning|deep learning|neural network)\b/.test(
    text
  );
  const isDiagnostic = /\b(diagnos|screen|detect|profil)/.test(text);
  const isBiomarker = /\b(biomarker|translational|molecular|genomic|proteomic)\b/.test(text);

  let primaryCategory = conference === 'ASCO' ? 'Developmental Therapeutics' : 'Miscellaneous';
  if (conference === 'ESMO' && isAI && isDiagnostic) {
    primaryCategory = 'AI for diagnostics and profiling';
  } else if (conference === 'ESMO' && isAI) {
    primaryCategory = 'AI for clinical research and drug development';
  } else if (conference === 'ESMO' && isBiomarker) {
    primaryCategory = 'Translational research and biomarkers';
  } else if (conference === 'ASCO' && /\bbreast|her2|triple[- ]negative\b/.test(text)) {
    primaryCategory = 'Breast Cancer';
  }

  const studyDesign = trialInProgress
    ? 'trial-in-progress'
    : /\b(randomi[sz]ed|phase [i1-3]|clinical trial|interventional)\b/.test(text)
      ? 'interventional-trial'
      : isAI
        ? 'ai-model-study'
        : isBiomarker
          ? 'biomarker-translational'
          : /\b(real[- ]world|registry|cohort|observational)\b/.test(text)
            ? 'observational-rwe'
            : /\b(systematic review|meta-analysis)\b/.test(text)
              ? 'systematic-review-meta-analysis'
              : isDiagnostic
                ? 'diagnostic-prognostic'
                : 'preclinical-basic';

  return {
    conference,
    submissionType,
    primaryCategory,
    alternativeCategories: [],
    studyDesign,
    confidence: primaryCategory === 'Miscellaneous' ? 0.55 : 0.82,
    rationale: [
      `Matched ${submissionType} pathway from the supplied study status and available results.`,
      `Matched ${primaryCategory} from the supplied oncology topic vocabulary.`,
    ],
    warnings: [],
    ruleVersion: profile.ruleVersion,
    presentationRecommendation:
      conference === 'ESMO' ? (trialInProgress ? 'poster' : 'rapid-oral') : undefined,
  };
}

export function buildOncologyPrompt(
  conference: OncologyConference,
  sourceText: string,
  classification: OncologyClassificationResult,
  mode: 'standard' | 'creative' | 'deep-update'
): string {
  const isTrialInProgress = classification.submissionType === 'trial-in-progress';
  const structure = isTrialInProgress
    ? conference === 'ESMO'
      ? 'Use Background and Trial design only.'
      : 'Use Background and Methods only.'
    : classification.submissionType === 'lba-intent' ||
        classification.submissionType === 'lba-shell'
      ? 'Write only the required late-breaking preliminary shell; distinguish expected from available information.'
      : 'Use Background, Methods, Results, and Conclusions.';
  const organizerRules =
    conference === 'ASCO'
      ? [
          'Keep title + body + table within 2,600 characters excluding spaces.',
          'Allow no figures and at most one table with no more than 10 rows.',
          'Do not state a presentation preference; ASCO assigns the presentation format.',
        ]
      : [
          'Keep title + body + table within 2,000 characters excluding spaces.',
          'Allow no figures and at most one table; the table counts as 225 characters by default and must not exceed 600 characters.',
          'Use no more than 20 authors and preserve patient anonymity.',
          isTrialInProgress
            ? 'The only compatible presentation recommendation is Poster or ePoster.'
            : 'Any presentation format is only a recommendation; the ESMO Scientific Committee makes the final decision.',
          'If AI generated or analyzed research data, describe the model and its use in Methods.',
          'AI may assist drafting only under human oversight; it cannot be an author and authors remain fully responsible.',
        ];

  return [
    `You are optimizing an oncology conference abstract under ${classification.ruleVersion}.`,
    `Mode: ${mode}. Submission pathway: ${classification.submissionType}.`,
    `Primary category: ${classification.primaryCategory}. Study design: ${classification.studyDesign}.`,
    structure,
    ...(isTrialInProgress
      ? ['A trial-in-progress abstract must not include results or preliminary data.']
      : []),
    ...organizerRules,
    'Use generic drug names. Do not write a case report. Keep ethics, consent, registration, funding, disclosure, prior-presentation, and embargo statements faithful to the source.',
    'Never invent sample sizes, outcomes, statistics, adverse events, approvals, registrations, dates, funding, conflicts, or citations. Mark missing facts as explicit author questions.',
    'Return an optimized abstract followed by a compliance report, unresolved author questions, inferred classification confidence, and an author-reviewable AI-assistance record.',
    'Source material:',
    sourceText,
  ].join('\n');
}
