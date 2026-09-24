import type { AnalysisResult, Category } from '../../types.js';

const TYPESAFE_ENDPOINT = 'https://api.typesafe.ai/v1/systemone';
const TYPESAFE_MODEL = 'jev-1.13.0';
const MAX_SOURCE_TEXT_LENGTH = 80_000;
const MAX_CONFERENCE_LENGTH = 64;
const MAX_CANDIDATES = 64;
const MAX_LABEL_LENGTH = 160;
const MAX_SERIALIZED_REQUEST_BYTES = 120_000;
const CATEGORY_SELECTION_THRESHOLD = 0.6;
const KEYWORD_SELECTION_THRESHOLD = 0.6;
const ACCEPTANCE_THRESHOLD = 0.8;

export interface JevAnalysisInput {
  text: string;
  conference: string;
  categories: Array<Pick<Category, 'name' | 'type'>>;
  keywords: string[];
}

export interface JevPreflight {
  isScientificSubmission: number;
  hasObjective: number;
  hasMethods: number;
  hasResults: number;
  hasConclusion: number;
  needsReview: boolean;
  reviewReason?: string;
}

export interface JevAnalysisOutput {
  analysis: AnalysisResult;
  preflight: JevPreflight;
  provider: 'typesafe';
  model: string;
  policyVersion: 'jev-analysis-v1';
}

export class TypesafeJevError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number
  ) {
    super(code);
    this.name = 'TypesafeJevError';
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function question(instructions: string) {
  return {
    type: 'noul',
    instructions,
    criteria: {
      true: 'The source text clearly supports this proposition.',
      false:
        'The source text does not clearly support this proposition, or the evidence is insufficient.',
    },
  };
}

export function sanitizeJevAnalysisInput(value: unknown): JevAnalysisInput {
  const body = asRecord(value);
  const text = typeof body?.text === 'string' ? body.text.trim() : '';
  const conference = typeof body?.conference === 'string' ? body.conference.trim() : '';
  if (
    !text ||
    text.length > MAX_SOURCE_TEXT_LENGTH ||
    !conference ||
    conference.length > MAX_CONFERENCE_LENGTH
  ) {
    throw new TypesafeJevError('invalid_jev_analysis_request', 400);
  }

  if (!Array.isArray(body?.categories) || !Array.isArray(body?.keywords)) {
    throw new TypesafeJevError('invalid_jev_analysis_candidates', 400);
  }
  if (
    body.categories.length < 2 ||
    body.categories.length > MAX_CANDIDATES ||
    body.keywords.length < 2 ||
    body.keywords.length > MAX_CANDIDATES
  )
    throw new TypesafeJevError('invalid_jev_analysis_candidates', 400);

  const categories = body.categories.map((candidate) => {
    const item = asRecord(candidate);
    const name = typeof item?.name === 'string' ? item.name.trim() : '';
    const type = item?.type;
    if (
      !name ||
      name.length > MAX_LABEL_LENGTH ||
      typeof type !== 'string' ||
      !['main', 'sub', 'secondary'].includes(String(type))
    ) {
      throw new TypesafeJevError('invalid_jev_analysis_candidates', 400);
    }
    return { name, type: type as Category['type'] };
  });
  const keywords = body.keywords.map((keyword) => {
    const label = typeof keyword === 'string' ? keyword.trim() : '';
    if (!label || label.length > MAX_LABEL_LENGTH) {
      throw new TypesafeJevError('invalid_jev_analysis_candidates', 400);
    }
    return label;
  });
  if (
    new Set(categories.map(({ name }) => name)).size !== categories.length ||
    new Set(keywords).size !== keywords.length
  )
    throw new TypesafeJevError('invalid_jev_analysis_candidates', 400);

  const input = { text, conference, categories, keywords };
  if (
    new TextEncoder().encode(JSON.stringify(buildJevAnalysisRequestUnchecked(input))).byteLength >
    MAX_SERIALIZED_REQUEST_BYTES
  ) {
    throw new TypesafeJevError('invalid_jev_analysis_request_size', 400);
  }
  return input;
}

export function buildJevAnalysisRequest(input: JevAnalysisInput) {
  return buildJevAnalysisRequestUnchecked(sanitizeJevAnalysisInput(input));
}

function buildJevAnalysisRequestUnchecked(input: JevAnalysisInput) {
  const categoryQuestions = input.categories.map((_, index) => [
    `category_${index}`,
    question(
      `Does candidateCategories[${index}] describe a meaningful primary or secondary topic of sourceText for the ${input.conference} submission? Treat incidental mentions as false.`
    ),
  ]);
  const keywordQuestions = input.keywords.map((_, index) => [
    `keyword_${index}`,
    question(
      `Does sourceText substantively discuss candidateKeywords[${index}] as a research concept, method, population, finding, or outcome? Treat incidental mentions as false.`
    ),
  ]);

  return {
    model: TYPESAFE_MODEL,
    state: {
      conference: input.conference,
      sourceText: input.text,
      candidateCategories: input.categories,
      candidateKeywords: input.keywords,
    },
    questions: {
      is_scientific_submission: question(
        'Does sourceText describe a real or proposed scientific study, technical method, clinical investigation, or research result?'
      ),
      has_objective: question(
        'Does sourceText state or clearly imply a research objective, question, or hypothesis?'
      ),
      has_methods: question(
        'Does sourceText describe a method, dataset, experiment, cohort, protocol, or analysis procedure?'
      ),
      has_results: question(
        'Does sourceText report an observation, result, comparison, or measured outcome?'
      ),
      has_conclusion: question(
        'Does sourceText state an interpretation, conclusion, implication, or practical meaning?'
      ),
      ...Object.fromEntries(categoryQuestions),
      ...Object.fromEntries(keywordQuestions),
    },
  };
}

function noulAnswer(answers: Record<string, unknown>, id: string): number {
  const answer = asRecord(answers[id]);
  if (
    answer?.type !== 'noul' ||
    typeof answer.noul !== 'number' ||
    !Number.isFinite(answer.noul) ||
    answer.noul < 0 ||
    answer.noul > 1
  )
    throw new TypesafeJevError('invalid_jev_analysis_response', 502);
  return answer.noul;
}

export function parseJevAnalysisResponse(
  payload: unknown,
  input: JevAnalysisInput
): JevAnalysisOutput {
  const result = asRecord(payload);
  const answers = asRecord(result?.answers);
  const model = result?.model === TYPESAFE_MODEL ? TYPESAFE_MODEL : null;
  const expectedAnswerIds = Object.keys(buildJevAnalysisRequest(input).questions);
  if (
    !answers ||
    !model ||
    Object.keys(answers).length !== expectedAnswerIds.length ||
    !expectedAnswerIds.every((id) => Object.prototype.hasOwnProperty.call(answers, id))
  )
    throw new TypesafeJevError('invalid_jev_analysis_response', 502);

  const isScientificSubmission = noulAnswer(answers, 'is_scientific_submission');
  const hasObjective = noulAnswer(answers, 'has_objective');
  const hasMethods = noulAnswer(answers, 'has_methods');
  const hasResults = noulAnswer(answers, 'has_results');
  const hasConclusion = noulAnswer(answers, 'has_conclusion');
  const rankedCategories = input.categories
    .map((candidate, index) => ({
      ...candidate,
      probability: noulAnswer(answers, `category_${index}`),
    }))
    .sort((left, right) => right.probability - left.probability);
  const selectedCategories = rankedCategories.filter(
    (candidate) => candidate.probability >= CATEGORY_SELECTION_THRESHOLD
  );
  // Preserve low-confidence, explicitly scored options for author selection.
  // A zero-candidate result would strand the conference panels before generation.
  const categories = (
    selectedCategories.length ? selectedCategories : rankedCategories.slice(0, 3)
  ).slice(0, 8);
  const rankedKeywords = input.keywords
    .map((keyword, index) => ({ keyword, probability: noulAnswer(answers, `keyword_${index}`) }))
    .sort((left, right) => right.probability - left.probability);
  const selectedKeywords = rankedKeywords.filter(
    (candidate) => candidate.probability >= KEYWORD_SELECTION_THRESHOLD
  );
  const keywords = (selectedKeywords.length ? selectedKeywords : rankedKeywords.slice(0, 5)).slice(
    0,
    12
  );
  const strongestCategory = Math.max(
    ...input.categories.map((_, index) => noulAnswer(answers, `category_${index}`))
  );
  const needsReview =
    isScientificSubmission < ACCEPTANCE_THRESHOLD ||
    strongestCategory < ACCEPTANCE_THRESHOLD ||
    selectedCategories.length === 0;

  return {
    analysis: {
      categories,
      keywords: keywords.map(({ keyword }) => keyword),
    },
    preflight: {
      isScientificSubmission,
      hasObjective,
      hasMethods,
      hasResults,
      hasConclusion,
      needsReview,
      ...(needsReview
        ? {
            reviewReason:
              isScientificSubmission < ACCEPTANCE_THRESHOLD
                ? 'source_not_confidently_scientific'
                : strongestCategory < ACCEPTANCE_THRESHOLD
                  ? 'category_uncertain'
                  : 'no_category_selected',
          }
        : {}),
    },
    provider: 'typesafe',
    model,
    policyVersion: 'jev-analysis-v1',
  };
}

export async function requestTypesafeJev(
  input: JevAnalysisInput,
  fetchImpl: typeof fetch = fetch
): Promise<JevAnalysisOutput> {
  const apiKey = process.env.TYPESAFE_API_KEY?.trim();
  if (!apiKey) throw new TypesafeJevError('typesafe_jev_unconfigured', 503);

  let response: Response;
  try {
    response = await fetchImpl(TYPESAFE_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(buildJevAnalysisRequest(input)),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new TypesafeJevError('typesafe_jev_unavailable', 503);
  }
  if (!response.ok) throw new TypesafeJevError('typesafe_jev_failed', 502);

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new TypesafeJevError('typesafe_jev_invalid_response', 502);
  }
  return parseJevAnalysisResponse(payload, input);
}
