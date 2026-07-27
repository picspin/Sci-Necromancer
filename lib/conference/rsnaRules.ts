import type {
  AnalysisResult,
  AbstractData,
  RSNAClassification,
  RSNAContentType,
  RSNACuttingEdgeTopic,
  RSNAPresentationFormat,
  RSNAReportingGuideline,
  ValidationResult,
} from '@/types';

export const RSNA_CUTTING_EDGE_TOPICS: ReadonlyArray<{
  name: RSNACuttingEdgeTopic;
  eligibility: string;
}> = [
  {
    name: 'Cancer Screening with Imaging in the Era of Precision Medicine',
    eligibility:
      'Late-breaking imaging research that advances risk stratification or early cancer detection.',
  },
  {
    name: 'Imaging of Early Chronic and Metabolic Diseases',
    eligibility:
      'Late-breaking imaging research on early detection, characterization, monitoring, or risk stratification of chronic or metabolic disease.',
  },
  {
    name: 'Imaging Biomarkers for Next-Generation Immune, Cellular, and Gene Therapies',
    eligibility:
      'Imaging biomarkers that guide, monitor, or de-risk immune, cellular, gene, or other advanced therapies.',
  },
  {
    name: 'Novel Applications of Photon Counting CT Not Currently Possible with “Standard” Spectral Energy Integrating Detectors (EID)',
    eligibility:
      'Novel photon-counting CT applications that are not feasible or adequately addressed with conventional EID CT; incremental routine improvements are insufficient.',
  },
  {
    name: 'High-Impact Clinical Trials in Radiology',
    eligibility:
      'Practice-changing imaging-centered clinical trials, preferably prospective and multicenter, with clinically meaningful outcomes; meta-analyses and systematic reviews are ineligible.',
  },
];

export const RSNA_CATEGORIES = [
  'Abdominal Imaging',
  'Breast Imaging',
  'Cardiac Imaging',
  'Chest Imaging',
  'Emergency Radiology',
  'Gastrointestinal Imaging',
  'Genitourinary Imaging',
  'Head and Neck Imaging',
  'Interventional Radiology',
  'Molecular Imaging',
  'Musculoskeletal Imaging',
  'Neuroradiology',
  'Nuclear Medicine',
  'Pediatric Imaging',
  'Physics',
  'Radiation Oncology',
  'Vascular and Interventional',
  "Women's Imaging",
] as const;

export const RSNA_RULESET = {
  version: 'RSNA-2026-provisional-2023-fallback',
  meetingYear: 2026,
  fallbackYear: 2023,
  verifiedAt: '2026-07-27',
  status: 'provisional' as const,
  science: {
    abstractCharactersExcludingSpaces: 2400,
    clinicalRelevanceCharacters: 200,
    sections: ['Purpose', 'Materials and Methods', 'Results', 'Conclusion'],
  },
  education: {
    abstractCharacters: 1350,
    reviewPdfSlides: 5,
    sections: ['Teaching Points', 'Table of Contents/Outline', 'PDF Upload'],
  },
  sources: [
    {
      label: 'RSNA 2026 Abstract Submission',
      url: 'https://www.rsna.org/annual-meeting/abstract-submission',
    },
    {
      label: 'RSNA Faculty and Presenter Resources',
      url: 'https://www.rsna.org/annual-meeting/attendee-resources/faculty-and-presenter-resources',
    },
    {
      label: 'RSNA 2023 fallback guidelines',
      url: 'https://github.com/picspin/Sci-Necromancer/blob/main/dist/RSNA2023.md',
    },
    { label: 'STARD for Abstracts', url: '/bmj.j3751.full.pdf' },
    { label: 'TRIPOD+AI for Abstracts', url: 'https://www.tripod-statement.org/abstracts/' },
  ],
} as const;

const PRESENTATION_ELIGIBILITY: Record<RSNAContentType, RSNAPresentationFormat[]> = {
  science: ['scientific-paper', 'digital-presentation', 'hardcopy-presentation'],
  education: [
    'digital-presentation',
    'standalone-education-exhibit',
    'hardcopy-presentation',
    'learning-center-theater',
  ],
};

export const getAllowedPresentationFormats = (
  contentType: RSNAContentType
): RSNAPresentationFormat[] => [...PRESENTATION_ELIGIBILITY[contentType]];

export const inferReportingGuidelines = (text: string): RSNAReportingGuideline[] => {
  const normalized = text.toLowerCase();
  const guidelines: RSNAReportingGuideline[] = [];
  const diagnosticAccuracy =
    /diagnostic accuracy|sensitivity|specificity|predictive value|\bauc\b|reference standard/.test(
      normalized
    );
  const predictionModel =
    /prediction model|prognostic model|risk model|model development|externally validated|external validation|machine learning/.test(
      normalized
    );

  if (diagnosticAccuracy) guidelines.push('STARD for Abstracts');
  if (predictionModel) guidelines.push('TRIPOD+AI for Abstracts');
  return guidelines;
};

const normalizeKeywords = (keywords: string[]): string[] => {
  const seen = new Set<string>();
  const aliases: Record<string, string> = {
    ai: 'Artificial Intelligence',
    'artificial intelligence': 'Artificial Intelligence',
    ml: 'Machine Learning',
    'machine learning': 'Machine Learning',
  };

  return keywords.flatMap((keyword) => {
    const trimmed = keyword.trim();
    if (!trimmed) return [];
    const canonical = aliases[trimmed.toLowerCase()] ?? trimmed;
    const key = canonical.toLowerCase();
    if (seen.has(key)) return [];
    seen.add(key);
    return [canonical];
  });
};

const defaultClassification = (): RSNAClassification => ({
  track: 'regular',
  contentType: 'science',
  primaryPresentationFormat: 'scientific-paper',
  alternativePresentationFormats: ['digital-presentation'],
  reportingGuidelines: [],
  confidence: 0.5,
  rationale: ['Provisional fallback classification; author confirmation is required.'],
  warnings: [
    'Detailed RSNA 2026 rules are not yet available; RSNA 2023 requirements are used provisionally.',
  ],
  ruleVersion: RSNA_RULESET.version,
});

export const normalizeRSNAAnalysis = (
  result: AnalysisResult & { rsna?: Partial<RSNAClassification> },
  sourceText = ''
): AnalysisResult & { rsna: RSNAClassification } => {
  const fallback = defaultClassification();
  const contentType = result.rsna?.contentType === 'education' ? 'education' : 'science';
  const allowedFormats = getAllowedPresentationFormats(contentType);
  const requestedPrimary = result.rsna?.primaryPresentationFormat;
  const primaryPresentationFormat =
    requestedPrimary && allowedFormats.includes(requestedPrimary)
      ? requestedPrimary
      : allowedFormats[0];
  const track = result.rsna?.track === 'cutting-edge' ? 'cutting-edge' : 'regular';
  const validTopic = RSNA_CUTTING_EDGE_TOPICS.some(
    (topic) => topic.name === result.rsna?.cuttingEdgeTopic
  )
    ? result.rsna?.cuttingEdgeTopic
    : undefined;

  const categories = [...(Array.isArray(result.categories) ? result.categories : [])]
    .filter(
      (category) => category?.name && (RSNA_CATEGORIES as readonly string[]).includes(category.name)
    )
    .sort((a, b) => b.probability - a.probability)
    .filter(
      (category, index, all) =>
        all.findIndex(
          (candidate) => candidate.name.toLowerCase() === category.name.toLowerCase()
        ) === index
    )
    .slice(0, 3);

  const inferredGuidelines = inferReportingGuidelines(sourceText);
  const requestedGuidelines = (result.rsna?.reportingGuidelines ?? []).filter(
    (guideline): guideline is RSNAReportingGuideline =>
      guideline === 'STARD for Abstracts' || guideline === 'TRIPOD+AI for Abstracts'
  );
  const reportingGuidelines = [...new Set([...requestedGuidelines, ...inferredGuidelines])];

  return {
    categories,
    keywords: normalizeKeywords(Array.isArray(result.keywords) ? result.keywords : []),
    rsna: {
      ...fallback,
      ...result.rsna,
      track,
      contentType,
      cuttingEdgeTopic: track === 'cutting-edge' ? validTopic : undefined,
      primaryPresentationFormat,
      alternativePresentationFormats: (result.rsna?.alternativePresentationFormats ?? [])
        .filter((format) => allowedFormats.includes(format) && format !== primaryPresentationFormat)
        .slice(0, 2),
      reportingGuidelines,
      confidence: Math.min(1, Math.max(0, result.rsna?.confidence ?? fallback.confidence)),
      rationale: result.rsna?.rationale?.filter(Boolean) ?? fallback.rationale,
      warnings: [...fallback.warnings, ...(result.rsna?.warnings?.filter(Boolean) ?? [])],
      ruleVersion: RSNA_RULESET.version,
    },
  };
};

export const validateRSNADraft = (abstract: AbstractData): ValidationResult => {
  const errors: string[] = [];
  const warnings = [
    'RSNA 2026 detailed requirements are not yet published; validation uses provisional RSNA 2023 fallback rules.',
  ];
  const content = abstract.abstract?.trim() ?? '';
  const contentType = abstract.rsna?.contentType ?? 'science';

  if (!content) errors.push('Abstract content is required');
  if (!abstract.keywords?.length) errors.push('At least one keyword is required');

  if (contentType === 'education') {
    if (content.length > RSNA_RULESET.education.abstractCharacters) {
      errors.push(
        `Education abstract exceeds ${RSNA_RULESET.education.abstractCharacters} characters: ${content.length}/${RSNA_RULESET.education.abstractCharacters}`
      );
    }
    for (const section of ['teaching points', 'table of contents']) {
      if (!content.toLowerCase().includes(section)) {
        errors.push(`Education abstract is missing ${section}`);
      }
    }
    warnings.push(
      `A review PDF plan must contain ${RSNA_RULESET.education.reviewPdfSlides} slides using verified original or properly licensed material.`
    );
  } else {
    const characterCount = content.replace(/\s/g, '').length;
    if (characterCount > RSNA_RULESET.science.abstractCharactersExcludingSpaces) {
      errors.push(
        `Science abstract exceeds ${RSNA_RULESET.science.abstractCharactersExcludingSpaces} characters excluding spaces: ${characterCount}/${RSNA_RULESET.science.abstractCharactersExcludingSpaces}`
      );
    }
    for (const section of RSNA_RULESET.science.sections) {
      const aliases =
        section === 'Materials and Methods'
          ? ['materials and methods', 'methods']
          : [section.toLowerCase()];
      if (!aliases.some((alias) => content.toLowerCase().includes(alias))) {
        errors.push(`Science abstract is missing ${section}`);
      }
    }
    if (!abstract.impact?.trim()) {
      errors.push('Clinical Relevance statement is required');
    } else if (abstract.impact.length > RSNA_RULESET.science.clinicalRelevanceCharacters) {
      errors.push(
        `Clinical Relevance exceeds ${RSNA_RULESET.science.clinicalRelevanceCharacters} characters`
      );
    }
  }

  if (/\b(university|hospital|institute|medical center|department of)\b/i.test(content)) {
    warnings.push('Possible institution identifier detected; confirm double-blind anonymization.');
  }
  return { isValid: errors.length === 0, errors, warnings };
};
