import type { GenerationMode, RSNAClassification } from '@/types';
import {
  RSNA_CATEGORIES,
  RSNA_CUTTING_EDGE_TOPICS,
  RSNA_KEYWORDS,
  RSNA_RULESET,
} from '@/lib/conference/rsnaRules';

export interface RSNAPromptInput {
  inputText: string;
  category: string;
  keywords: string[];
  classification: RSNAClassification;
  mode: GenerationMode;
  auxiliaryLocale?: 'en' | 'zh';
}

const cuttingEdgeRules = RSNA_CUTTING_EDGE_TOPICS.map(
  (topic) => `- ${topic.name}: ${topic.eligibility}`
).join('\n');

export const getRSNAAnalysisPrompt = (
  text: string,
  auxiliaryLocale: 'en' | 'zh' = 'en'
): string => `
You are an RSNA submission classifier. Analyze only the supplied facts and return valid JSON.
Keep categories, keywords and enum values in English. Write rationale and warnings in ${auxiliaryLocale === 'zh' ? 'Simplified Chinese' : 'English'}.

Classify the submission using three distinct layers:
1. submission track: "regular" or "cutting-edge". Use cutting-edge only when the work clearly satisfies one of the five eligibility descriptions below; otherwise use regular.
2. content type: choose science or education — "science" for hypothesis-driven research or "education" for teaching/review content.
3. likely presentation format. This is a recommendation only, never an RSNA assignment.

Cutting-edge topics and strict eligibility:
${cuttingEdgeRules}

Presentation eligibility:
- Science: scientific-paper, digital-presentation; hardcopy-presentation is conditional/supplemental.
- Education: digital-presentation, standalone-education-exhibit; hardcopy-presentation and learning-center-theater are conditional opportunities.

Choose up to three category candidates from this controlled vocabulary, ranked by probability, but identify exactly one primary RSNA category through the highest probability:
${RSNA_CATEGORIES.join(', ')}

Choose 3-7 keywords only from this controlled RSNA reference vocabulary:
${RSNA_KEYWORDS.join(', ')}

Detect reporting guidance conditionally:
- STARD for Abstracts only for diagnostic accuracy studies.
- TRIPOD+AI for Abstracts for development, validation, or updating of diagnostic/prognostic prediction models, regardless of regression or machine-learning method.

Return this JSON shape:
{
  "categories": [{"name":"...","type":"main","probability":0.0}],
  "keywords": ["3-7 normalized keywords"],
  "rsna": {
    "track":"regular|cutting-edge",
    "contentType":"science|education",
    "cuttingEdgeTopic":"exact topic or omit",
    "primaryPresentationFormat":"scientific-paper|digital-presentation|standalone-education-exhibit|hardcopy-presentation|learning-center-theater",
    "alternativePresentationFormats":[],
    "reportingGuidelines":[],
    "confidence":0.0,
    "rationale":["evidence tied to supplied text"],
    "warnings":["missing facts or eligibility failures"],
    "ruleVersion":"${RSNA_RULESET.version}"
  }
}

Never force a cutting-edge match. Never infer completed results, ethics approval, registration, multicenter status, or prospective design when absent.

SOURCE TEXT:
${text}
`;

const reportingGuidance = (classification: RSNAClassification): string => {
  const sections: string[] = [];
  if (classification.reportingGuidelines.includes('STARD for Abstracts')) {
    sections.push(
      `STARD for Abstracts minimum items: identify diagnostic accuracy; objective; prospective/retrospective collection; eligibility and setting; consecutive/random/convenience sampling; index test and reference standard; participants with/without target condition; accuracy estimates with precision such as 95% CI; interpretation; intended clinical use; registration when available.`
    );
  }
  if (classification.reportingGuidelines.includes('TRIPOD+AI for Abstracts')) {
    sections.push(
      `TRIPOD+AI for Abstracts: identify development/evaluation and model purpose; data source and setting; participants; outcome; predictors; sample size and outcome count; missing data; model development/evaluation methods; performance with uncertainty including discrimination and calibration where applicable; final predictors for development; interpretation, limitations and implications; registration/repository when available. TRIPOD+AI 2024 supersedes TRIPOD 2015.`
    );
  }
  return sections.length ? sections.join('\n') : 'No STARD/TRIPOD+AI extension was triggered.';
};

const outputContract = (classification: RSNAClassification): string =>
  classification.contentType === 'science'
    ? `SCIENCE OUTPUT CONTRACT (provisional RSNA 2023 fallback):
- Title
- PURPOSE / MATERIALS AND METHODS / RESULTS / CONCLUSION
- Abstract body maximum ${RSNA_RULESET.science.abstractCharactersExcludingSpaces} characters excluding spaces
- Clinical Relevance maximum ${RSNA_RULESET.science.clinicalRelevanceCharacters} characters
- Include quantitative results and uncertainty only when present in the source.`
    : `EDUCATION OUTPUT CONTRACT (provisional RSNA 2023 fallback):
- Title
- Teaching Points
- Table of Contents/Outline
- Abstract maximum ${RSNA_RULESET.education.abstractCharacters} characters
- Five-slide Review PDF Plan: return exactly five presentationGuidance items prefixed Slide 1 through Slide 5, describing the original image/chart/teaching material the author must provide; do not create or claim ownership of source material.`;

export const getRSNAGenerationPrompt = (input: RSNAPromptInput): string => `
You are an expert RSNA abstract editor. Produce a submission-oriented English draft as valid JSON.
Write title, abstract, impact, synopsis, and keywords in English. Write presentationGuidance and complianceWarnings in ${input.auxiliaryLocale === 'zh' ? 'Simplified Chinese' : 'English'}.

MODE: ${input.mode === 'creative' ? 'Aggressive rhetorical polishing (一键炼丹)' : 'Standards-based editing'}
TRACK: ${input.classification.track}
CONTENT TYPE: ${input.classification.contentType}
CATEGORY: ${input.category}
KEYWORDS: ${input.keywords.join(', ')}
LIKELY PRESENTATION FORMAT: ${input.classification.primaryPresentationFormat} (recommendation only)
${input.classification.cuttingEdgeTopic ? `CUTTING-EDGE TOPIC: ${input.classification.cuttingEdgeTopic}` : ''}

${outputContract(input.classification)}

REPORTING GUIDANCE:
${reportingGuidance(input.classification)}

RSNA COMPLIANCE:
- Apply double-blind review: flag author, institution, hospital, city, or location identifiers and replace them with [INSTITUTION] when needed.
- Keep content fair, balanced, scientifically rigorous, and free of commercial promotion.
- CME Activity Disclosure is separate from the product's AI Assistance Record. Remind every presenter to disclose either no relevant financial relationships or all relevant financial relationships from the preceding 24 months, and flag employment/ownership by an ineligible company for author review.
- Never generate, infer, or complete a presenter's CME disclosure; preserve supplied disclosure facts verbatim and direct the author to the official RSNA disclosure workflow.
- State conflicts, funding, ethics approval, registration, consent, and prior presentation only when supplied.
- The active detailed template is provisional: RSNA 2023 is used until RSNA 2026 detailed rules are published.

FACTUAL INTEGRITY — NON-NEGOTIABLE:
- Do not invent or alter sample sizes, patient characteristics, methods, numerical results, p-values, confidence intervals, effect sizes, ethics approval, registration numbers, external validation, citations, cases, images, permissions, or disclosures.
- When a required fact is missing, use an explicit placeholder beginning with [INSERT ...] and add it to complianceWarnings.
- If source facts conflict, preserve the conflict in complianceWarnings; do not silently resolve it.
- Improve expression aggressively when requested, but never fabricate evidence.

Return JSON:
{
  "title":"concise anonymized English title",
  "abstract":"complete structured submission content",
  "impact":"Clinical Relevance for science, or concise educational impact for education",
  "synopsis":"brief factual synopsis",
  "keywords":[],
  "presentationGuidance":["format-specific preparation suggestions; do not promise assignment"],
  "complianceWarnings":["missing facts, provisional-rule notice, anonymity or commercial-bias risks"]
}

AUTHOR SOURCE — preserve its facts:
${input.inputText}
`;

export const getRSNACreativePrompt = (input: RSNAPromptInput): string => `
The creative mode may sharpen framing, title, flow, clinical significance, and teaching narrative, but must never fabricate research data or provenance.
${getRSNAGenerationPrompt({ ...input, mode: 'creative' })}
`;
