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

export const RSNA_KEYWORDS = [
  'CT',
  'MRI',
  'Ultrasound',
  'X-ray',
  'Mammography',
  'Tomosynthesis',
  'PET/CT',
  'SPECT',
  'Artificial Intelligence/Machine Learning',
  'Computer-aided Detection/Diagnosis',
  'Contrast Agents',
  'GI Tract',
  'Hepatobiliary',
  'Genitourinary',
  'Retroperitoneum',
  'Perfusion',
  'Diffusion',
  'Diagnosis',
  'Biopsy',
  'Dense Breast Tissue',
  'CT Angiography',
  'Echocardiography',
  'Coronary Artery Disease',
  'Cardiomyopathy',
  'Valvular Disease',
  'Lung Cancer',
  'Thoracic CT',
  'Chest X-ray',
  'Pulmonary',
  'Pneumonia',
  'COVID-19',
  'Pulmonary Embolism',
  'COPD',
  'Trauma',
  'Acute Abdomen',
  'Point-of-Care Ultrasound',
  'Workflow',
  'Triage',
  'Inflammatory Bowel Disease',
  'Upper GI',
  'Lower GI',
  'Liver Disease',
  'Pancreatic Disease',
  'Renal Masses',
  'Kidney',
  'Bladder',
  'Prostate',
  'Adrenal',
  'Prostate Cancer',
  'Urolithiasis',
  'Functional Imaging',
  'Infection',
  'Brain',
  'Spine',
  'ENT',
  'Orbit',
  'Vascular Malformations',
  'Embolization',
  'Ablation',
  'Drainage',
  'Stent Placement',
  'Vascular',
  'Non-vascular',
  'Oncologic',
  'Theranostics',
  'Radiopharmaceuticals',
  'Cardiology',
  'Neurology',
  'Arthritis',
  'Fractures',
  'Sports Injuries',
  'Bone',
  'Joint',
  'Soft Tissue',
  'Dementia',
  'Multiple Sclerosis',
  'Epilepsy',
  'Head/Neck',
  'Therapy',
  'Cardiac',
  'Neurologic',
  'Bone Imaging',
  'Congenital Anomalies',
  'Neonatal',
  'Pediatric',
  'Adolescent',
  'Oncology',
  'Reconstruction',
  'Optimization',
  'Safety',
  'Innovation',
  'Dose',
  'Technology',
  'Treatment Planning',
  'Quality Assurance',
  'Adaptive Therapy',
  'IGRT',
  'SBRT',
  'Dose Calculation',
  'Angiography',
  'Intervention',
  'Stenting',
  'Arterial',
  'Venous',
  'Lymphatic',
  'Pregnancy',
  'Breast',
  'Gynecologic',
  'Obstetric',
  'Dose Reduction',
  'Image Quality',
  'Workflow Optimization',
  'Cost-effectiveness',
  'Patient Safety',
  'Quality Improvement',
  'Education/Training',
  'Research Methods',
  'Statistical Analysis',
  'Clinical Outcomes',
  'Diagnostic Accuracy',
  'Sensitivity',
  'Specificity',
  'Positive Predictive Value',
  'Negative Predictive Value',
  'Area Under Curve (AUC)',
  'ROC Analysis',
  'Confidence Interval',
  'P-value',
  'Effect Size',
  'Statistical Significance',
  'Power Analysis',
  'Sample Size Calculation',
  'Multivariate Analysis',
  'Regression Analysis',
  'Correlation Analysis',
  'Inter-rater Reliability',
  'Kappa Statistics',
  'Inter-observer Agreement',
  'Reproducibility',
  'Validation Studies',
  'Multicenter Studies',
  'Retrospective Study',
  'Prospective Study',
  'Case-Control Study',
  'Cohort Study',
  'Randomized Controlled Trial',
  'Meta-analysis',
  'Systematic Review',
  'Technical Innovation',
  'Phantom Study',
  'Pilot Study',
  'Feasibility Study',
  'Validation Study',
  'Stroke',
  'Tumor',
  'Screening',
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
      url: '/RSNA2023.md',
    },
    { label: 'STARD for Abstracts', url: 'https://www.bmj.com/content/358/bmj.j3751' },
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
  const predictionIntent = /prediction model|prognostic model|risk model|diagnostic model/.test(
    normalized
  );
  const modelLifecycle = /develop(?:ed|ment|ing)?|validat(?:e|ed|ion|ing)|updat(?:e|ed|ing)/.test(
    normalized
  );

  if (diagnosticAccuracy) guidelines.push('STARD for Abstracts');
  if (predictionIntent && modelLifecycle) guidelines.push('TRIPOD+AI for Abstracts');
  return guidelines;
};

export const normalizeRSNAKeywords = (keywords: string[]): string[] => {
  const seen = new Set<string>();
  const aliases: Record<string, string> = {
    ai: 'Artificial Intelligence/Machine Learning',
    'artificial intelligence': 'Artificial Intelligence/Machine Learning',
    ml: 'Artificial Intelligence/Machine Learning',
    'machine learning': 'Artificial Intelligence/Machine Learning',
    auc: 'Area Under Curve (AUC)',
    'ai/cad': 'Computer-aided Detection/Diagnosis',
  };
  const controlled = new Map(
    RSNA_KEYWORDS.map((keyword) => [keyword.toLowerCase(), keyword] as const)
  );

  return keywords
    .flatMap((keyword) => {
      const trimmed = keyword.trim();
      if (!trimmed) return [];
      const alias = aliases[trimmed.toLowerCase()] ?? trimmed;
      const canonical = controlled.get(alias.toLowerCase());
      if (!canonical) return [];
      const key = canonical.toLowerCase();
      if (seen.has(key)) return [];
      seen.add(key);
      return [canonical];
    })
    .slice(0, 7);
};

const defaultClassification = (locale: 'en' | 'zh' = 'en'): RSNAClassification => ({
  track: 'regular',
  contentType: 'science',
  primaryPresentationFormat: 'scientific-paper',
  alternativePresentationFormats: ['digital-presentation'],
  reportingGuidelines: [],
  confidence: 0.5,
  rationale: [
    locale === 'zh'
      ? '临时回退分类，必须由作者确认。'
      : 'Provisional fallback classification; author confirmation is required.',
  ],
  warnings: [
    locale === 'zh'
      ? 'RSNA 2026 详细规则尚未发布，当前暂用 RSNA 2023 要求。'
      : 'Detailed RSNA 2026 rules are not yet available; RSNA 2023 requirements are used provisionally.',
  ],
  ruleVersion: RSNA_RULESET.version,
});

export const normalizeRSNAAnalysis = (
  result: Omit<AnalysisResult, 'rsna'> & { rsna?: Partial<RSNAClassification> },
  sourceText = '',
  locale: 'en' | 'zh' = 'en'
): AnalysisResult & { rsna: RSNAClassification } => {
  const fallback = defaultClassification(locale);
  const contentType = result.rsna?.contentType === 'education' ? 'education' : 'science';
  const allowedFormats = getAllowedPresentationFormats(contentType);
  const requestedPrimary = result.rsna?.primaryPresentationFormat;
  const primaryPresentationFormat =
    requestedPrimary && allowedFormats.includes(requestedPrimary)
      ? requestedPrimary
      : allowedFormats[0];
  const requestedCuttingEdge = result.rsna?.track === 'cutting-edge';
  const validTopic = RSNA_CUTTING_EDGE_TOPICS.some(
    (topic) => topic.name === result.rsna?.cuttingEdgeTopic
  )
    ? result.rsna?.cuttingEdgeTopic
    : undefined;
  const track: RSNAClassification['track'] =
    requestedCuttingEdge && validTopic ? 'cutting-edge' : 'regular';

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
  const reportingGuidelines = inferredGuidelines;
  const unsupportedGuidelines = requestedGuidelines.filter(
    (guideline) => !inferredGuidelines.includes(guideline)
  );
  const normalizedKeywords = normalizeRSNAKeywords(
    Array.isArray(result.keywords) ? result.keywords : []
  );
  const droppedKeywordCount = Math.max(
    0,
    (result.keywords?.length ?? 0) - normalizedKeywords.length
  );

  return {
    categories,
    keywords: normalizedKeywords,
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
      warnings: [
        ...fallback.warnings,
        ...(requestedCuttingEdge && !validTopic
          ? [
              locale === 'zh'
                ? '未能确认符合五个前沿研究主题之一，已降级为常规投稿。'
                : 'Cutting-edge eligibility was not established for one of the five allowed topics; downgraded to regular.',
            ]
          : []),
        ...(droppedKeywordCount
          ? [
              locale === 'zh'
                ? `已移除 ${droppedKeywordCount} 个不在 RSNA 参考词表中的关键词建议。`
                : `${droppedKeywordCount} keyword suggestion(s) were removed during controlled normalization.`,
            ]
          : []),
        ...(unsupportedGuidelines.length
          ? [
              locale === 'zh'
                ? `源文不符合条件，已移除报告规范：${unsupportedGuidelines.join(', ')}。`
                : `Reporting guidance not supported by the source was removed: ${unsupportedGuidelines.join(', ')}.`,
            ]
          : []),
        ...(result.rsna?.warnings?.filter(Boolean) ?? []),
      ],
      ruleVersion: RSNA_RULESET.version,
    },
  };
};

export const enforceRSNASourceFidelity = (
  draft: AbstractData,
  sourceText: string,
  locale: 'en' | 'zh' = 'en'
): AbstractData => {
  const sourceNumbers = new Set(
    (sourceText.match(/[-+]?\b\d+(?:[.,]\d+)?%?\b/g) ?? []).map((value) => value.replace(',', ''))
  );
  const unsupportedNumbers = new Set<string>();
  const unsupportedClaims: Array<[RegExp, string, string]> = [
    [
      /ethics approval|institutional review board|\bIRB\b|伦理审批|机构审查委员会/i,
      'ethics approval',
      '伦理审批',
    ],
    [/informed consent|知情同意/i, 'consent status', '知情同意状态'],
    [/\bregistered\b|registration number|\bNCT\d{8}\b|注册号|已注册/i, 'registration', '注册信息'],
  ];
  const replacedClaims = new Set<string>();
  const claimPolarity = (sentence: string): 'positive' | 'negative' | 'unknown' => {
    if (/\bnot\b|\bno\b|without|waiv|exempt|pending|未|无|未经|豁免|待定/i.test(sentence)) {
      return 'negative';
    }
    if (
      /obtain|approv|grant|register|provided|\bNCT\d{8}\b|已获|通过|取得|已注册/i.test(sentence)
    ) {
      return 'positive';
    }
    return 'unknown';
  };
  const claimSentence = (value: string, pattern: RegExp): string | null =>
    value.match(
      new RegExp(`[^.!?。！？]*(?:${pattern.source})[^.!?。！？]*[.!?。！？]?`, 'i')
    )?.[0] ?? null;

  const sanitize = (
    value: string | undefined,
    preserveStructuralIndices = false
  ): string | undefined => {
    if (value === undefined) return undefined;
    let sanitized = value.replace(
      /[-+]?\b\d+(?:[.,]\d+)?%?\b/g,
      (number, offset: number, fullText: string) => {
        const prefix = fullText.slice(Math.max(0, offset - 8), offset);
        const suffix = fullText.slice(offset + number.length);
        const isSlideIndex = /(?:slide\s*|第\s*)$/i.test(prefix) && /^[1-5]$/.test(number);
        const textBeforeNumber = fullText.slice(0, offset);
        const outlineHeadings = [
          ...textBeforeNumber.matchAll(/(?:table of contents|outline|目录|大纲)\s*[:：]/gi),
        ];
        const outlineStart = outlineHeadings.at(-1)?.index ?? -1;
        const textSinceOutline =
          outlineStart >= 0 ? textBeforeNumber.slice(outlineStart) : textBeforeNumber;
        const isOutlineIndex =
          outlineStart >= 0 &&
          !/\b(?:purpose|materials and methods|methods|results|conclusion)\s*:/i.test(
            textSinceOutline
          ) &&
          /^\d{1,2}$/.test(number) &&
          /^[.)、]\s*\p{L}/u.test(suffix);
        if (preserveStructuralIndices && (isSlideIndex || isOutlineIndex)) {
          return number;
        }
        if (sourceNumbers.has(number.replace(',', ''))) return number;
        unsupportedNumbers.add(number);
        return locale === 'zh' ? '[请插入经核验数值]' : '[INSERT verified value]';
      }
    );

    for (const [pattern, englishLabel, chineseLabel] of unsupportedClaims) {
      const sourceSentence = claimSentence(sourceText, pattern);
      const sourcePolarity = sourceSentence ? claimPolarity(sourceSentence) : 'unknown';
      sanitized = sanitized.replace(
        new RegExp(`[^.!?。！？]*(?:${pattern.source})[^.!?。！？]*[.!?。！？]?`, 'gi'),
        (generatedSentence) => {
          if (sourcePolarity !== 'unknown' && sourcePolarity === claimPolarity(generatedSentence)) {
            return generatedSentence;
          }
          replacedClaims.add(locale === 'zh' ? chineseLabel : englishLabel);
          return locale === 'zh'
            ? `[请插入经核验的${chineseLabel}]。`
            : `[INSERT verified ${englishLabel}].`;
        }
      );
    }
    return sanitized;
  };

  const sanitizedTitle = sanitize(draft.title);
  const sanitizedAbstract = sanitize(draft.abstract, true);
  const sanitizedImpact = sanitize(draft.impact) ?? '';
  const sanitizedSynopsis = sanitize(draft.synopsis) ?? '';
  const sanitizedGuidance = draft.presentationGuidance?.map((item) => sanitize(item, true) ?? '');

  const warnings = [...(draft.complianceWarnings ?? [])];
  if (unsupportedNumbers.size) {
    warnings.push(
      locale === 'zh'
        ? `已将源文中不存在的数值替换为占位符：${[...unsupportedNumbers].join(', ')}。`
        : `Unsupported numeric claims were replaced with placeholders: ${[...unsupportedNumbers].join(', ')}.`
    );
  }
  if (replacedClaims.size) {
    warnings.push(
      locale === 'zh'
        ? `已将源文中不一致或不存在的状态声明替换为占位符：${[...replacedClaims].join(', ')}。`
        : `Unsupported or inconsistent status claims were replaced with placeholders: ${[...replacedClaims].join(', ')}.`
    );
  }
  return {
    ...draft,
    title: sanitizedTitle,
    abstract: sanitizedAbstract,
    impact: sanitizedImpact,
    synopsis: sanitizedSynopsis,
    presentationGuidance: sanitizedGuidance,
    complianceWarnings: warnings,
  };
};

export const validateRSNADraft = (
  abstract: AbstractData,
  locale: 'en' | 'zh' = 'en'
): ValidationResult => {
  const message = (english: string, chinese: string) => (locale === 'zh' ? chinese : english);
  const errors: string[] = [];
  const warnings = [
    message(
      'RSNA 2026 detailed requirements are not yet published; validation uses provisional RSNA 2023 fallback rules.',
      'RSNA 2026 详细要求尚未发布；当前校验暂用 RSNA 2023 回退规则。'
    ),
  ];
  const content = abstract.abstract?.trim() ?? '';
  const contentType = abstract.rsna?.contentType ?? 'science';

  if (!content) errors.push(message('Abstract content is required', '摘要正文不能为空'));
  if (!abstract.title?.trim()) errors.push(message('Title is required', '标题不能为空'));
  if (!abstract.keywords?.length)
    errors.push(message('At least one keyword is required', '至少需要一个关键词'));
  if (abstract.rsna?.track === 'cutting-edge' && !abstract.rsna.cuttingEdgeTopic) {
    errors.push(
      message(
        'Cutting-edge submissions require one of the five eligible topics',
        '前沿研究投稿必须选择五个合资格主题之一'
      )
    );
  }

  if (contentType === 'education') {
    if (content.length > RSNA_RULESET.education.abstractCharacters) {
      errors.push(
        message(
          `Education abstract exceeds ${RSNA_RULESET.education.abstractCharacters} characters: ${content.length}/${RSNA_RULESET.education.abstractCharacters}`,
          `教育摘要超过 ${RSNA_RULESET.education.abstractCharacters} 字符：${content.length}/${RSNA_RULESET.education.abstractCharacters}`
        )
      );
    }
    for (const section of ['teaching points', 'table of contents']) {
      if (!content.toLowerCase().includes(section)) {
        errors.push(message(`Education abstract is missing ${section}`, `教育摘要缺少 ${section}`));
      }
    }
    warnings.push(
      message(
        `A review PDF plan must contain ${RSNA_RULESET.education.reviewPdfSlides} slides using verified original or properly licensed material.`,
        `审稿 PDF 计划必须包含 ${RSNA_RULESET.education.reviewPdfSlides} 页，并使用经核验的原创或已获许可材料。`
      )
    );
    const plannedSlides = new Set(
      (abstract.presentationGuidance ?? [])
        .map((item) => {
          const match = item.match(/\bslide\s*([1-5])\b|第\s*([1-5])\s*页/i);
          return match?.[1] ?? match?.[2];
        })
        .filter(Boolean)
    );
    if (plannedSlides.size < RSNA_RULESET.education.reviewPdfSlides) {
      errors.push(
        message(
          'Education exhibits require an explicit five-slide Review PDF Plan',
          '教育展项必须提供明确的五页审稿 PDF 计划'
        )
      );
    }
  } else {
    const characterCount = content.replace(/\s/g, '').length;
    if (characterCount > RSNA_RULESET.science.abstractCharactersExcludingSpaces) {
      errors.push(
        message(
          `Science abstract exceeds ${RSNA_RULESET.science.abstractCharactersExcludingSpaces} characters excluding spaces: ${characterCount}/${RSNA_RULESET.science.abstractCharactersExcludingSpaces}`,
          `科学摘要超过不计空格 ${RSNA_RULESET.science.abstractCharactersExcludingSpaces} 字符的限制：${characterCount}/${RSNA_RULESET.science.abstractCharactersExcludingSpaces}`
        )
      );
    }
    for (const section of RSNA_RULESET.science.sections) {
      const aliases =
        section === 'Materials and Methods'
          ? ['materials and methods', 'methods']
          : [section.toLowerCase()];
      if (!aliases.some((alias) => content.toLowerCase().includes(alias))) {
        errors.push(message(`Science abstract is missing ${section}`, `科学摘要缺少 ${section}`));
      }
    }
    if (!abstract.impact?.trim()) {
      errors.push(
        message('Clinical Relevance statement is required', '必须提供 Clinical Relevance 声明')
      );
    } else if (abstract.impact.length > RSNA_RULESET.science.clinicalRelevanceCharacters) {
      errors.push(
        message(
          `Clinical Relevance exceeds ${RSNA_RULESET.science.clinicalRelevanceCharacters} characters`,
          `Clinical Relevance 超过 ${RSNA_RULESET.science.clinicalRelevanceCharacters} 字符限制`
        )
      );
    }
  }

  const blindReviewText = [abstract.title, content, abstract.impact, abstract.synopsis].join('\n');
  if (/\b(university|hospital|institute|medical center|department of)\b/i.test(blindReviewText)) {
    warnings.push(
      message(
        'Possible institution identifier detected; confirm double-blind anonymization.',
        '检测到可能的机构标识，请确认符合双盲匿名要求。'
      )
    );
  }
  return { isValid: errors.length === 0, errors, warnings };
};
