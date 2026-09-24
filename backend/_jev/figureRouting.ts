import { TypesafeJevError } from './typesafe.js';

const TYPESAFE_ENDPOINT = 'https://api.typesafe.ai/v1/systemone';
const TYPESAFE_MODEL = 'jev-1.13.0';
export const FIGURE_ROUTING_POLICY_VERSION = 'jev-figure-routing-v1' as const;
const MAX_GOAL_LENGTH = 1_000;
const MAX_ALIAS_LENGTH = 120;
const MAX_UNIT_LENGTH = 48;
const MAX_FIELDS = 32;
const MAX_SUMMARIES = 12;
const MAX_REQUEST_BYTES = 40_000;
const MIN_SELECTED_PROBABILITY = 0.8;
const MIN_MARGIN = 0.15;

/** Server-owned chart templates. Jev may select one of these IDs, never invent one. */
export const DATA_CHART_TEMPLATE_IDS = [
  'grouped-bar',
  'multi-panel-trend',
  'heatmap',
  'volcano',
  'forest-plot',
  'kaplan-meier',
  'box-violin',
  'scatter-regression',
  'roc-pr',
  'alluvial-sankey',
  'dot-whisker',
] as const;
export type DataChartTemplateId = (typeof DATA_CHART_TEMPLATE_IDS)[number];

/** The seven illustration families already supported by the product. */
export const ILLUSTRATION_CATEGORY_IDS = [
  'graphical-abstract',
  'mechanism-pathway',
  'clinical-workflow',
  'study-design',
  'molecular-cellular',
  'imaging-anatomy',
  'ai-model-pipeline',
] as const;
export type IllustrationCategoryId = (typeof ILLUSTRATION_CATEGORY_IDS)[number];

export const JOURNAL_STYLE_IDS = [
  'lancet',
  'nature',
  'nejm',
  'science',
  'jama-bmj',
  'radiology',
  'ieee',
  'cell',
  'pnas',
] as const;
export type JournalStyleId = (typeof JOURNAL_STYLE_IDS)[number];

type AggregateSummary = { key: string; value: number | boolean | null };
export interface DataFigureRoutingInput {
  fields: Array<{
    alias: string;
    type: 'categorical' | 'continuous' | 'binary' | 'date' | 'count' | 'proportion';
    unit?: string;
  }>;
  aggregateSummaries?: AggregateSummary[];
  goal: string;
}

export interface IllustrationCategoryRoutingInput {
  researchIntent: string;
  userCategory?: IllustrationCategoryId;
}

export interface IllustrationJournalRoutingInput {
  researchIntent: string;
  category: IllustrationCategoryId;
  userJournalStyle?: JournalStyleId;
}

export interface PromptCompletenessInput {
  prompt: string;
  category: IllustrationCategoryId;
}

export type FigureRoutingAnswer = {
  type: 'choice';
  choice: string;
  probabilities: Record<string, number>;
  confidence: number;
};

export interface FigureRoutingDecision<T extends string> {
  selected: T | 'unknown';
  needsReview: boolean;
  probability: number | null;
  policyVersion: typeof FIGURE_ROUTING_POLICY_VERSION;
  provider: 'typesafe';
  model: string;
}

export interface PromptCompletenessDecision {
  selected: 'complete' | 'needs_revision' | 'unknown';
  missing: Array<'subject' | 'layout' | 'relationships' | 'style' | 'constraints'>;
  needsReview: boolean;
  policyVersion: typeof FIGURE_ROUTING_POLICY_VERSION;
  provider: 'typesafe';
  model: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isOneOf<T extends readonly string[]>(value: unknown, allowed: T): value is T[number] {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value);
}

function ensureRequestSize(value: unknown): void {
  if (new TextEncoder().encode(JSON.stringify(value)).byteLength > MAX_REQUEST_BYTES) {
    throw new TypesafeJevError('invalid_jev_figure_request_size', 413);
  }
}

function choiceQuestion(instructions: string, allowed: readonly string[]) {
  return {
    type: 'choice',
    instructions,
    criteria: Object.fromEntries([
      ...allowed.map((id) => [id, `The supplied evidence supports the ${id} candidate.`]),
      ['unknown', 'The evidence is insufficient or candidates overlap; request human selection.'],
    ]),
  };
}

function sanitizeCommonGoal(value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > MAX_GOAL_LENGTH) {
    throw new TypesafeJevError('invalid_jev_figure_request', 400);
  }
  return value.trim();
}

export function sanitizeDataFigureRoutingInput(value: unknown): DataFigureRoutingInput {
  if (
    !isRecord(value) ||
    Object.keys(value).some((key) => !['fields', 'aggregateSummaries', 'goal'].includes(key)) ||
    !Array.isArray(value.fields) ||
    value.fields.length < 1 ||
    value.fields.length > MAX_FIELDS
  ) {
    throw new TypesafeJevError('invalid_jev_data_figure_request', 400);
  }
  const fields = value.fields.map((field) => {
    if (!isRecord(field)) throw new TypesafeJevError('invalid_jev_data_figure_fields', 400);
    const alias = typeof field.alias === 'string' ? field.alias.trim() : '';
    const unit =
      field.unit === undefined
        ? undefined
        : typeof field.unit === 'string'
          ? field.unit.trim()
          : null;
    if (
      !alias ||
      alias.length > MAX_ALIAS_LENGTH ||
      !isOneOf(field.type, [
        'categorical',
        'continuous',
        'binary',
        'date',
        'count',
        'proportion',
      ] as const) ||
      unit === null ||
      (unit !== undefined && unit.length > MAX_UNIT_LENGTH) ||
      Object.keys(field).some((key) => !['alias', 'type', 'unit'].includes(key))
    )
      throw new TypesafeJevError('invalid_jev_data_figure_fields', 400);
    return { alias, type: field.type, ...(unit ? { unit } : {}) };
  });
  if (new Set(fields.map((field) => field.alias)).size !== fields.length) {
    throw new TypesafeJevError('invalid_jev_data_figure_fields', 400);
  }
  const summaries = value.aggregateSummaries === undefined ? [] : value.aggregateSummaries;
  if (!Array.isArray(summaries) || summaries.length > MAX_SUMMARIES) {
    throw new TypesafeJevError('invalid_jev_data_figure_summaries', 400);
  }
  const aggregateSummaries = summaries.map((summary) => {
    if (
      !isRecord(summary) ||
      typeof summary.key !== 'string' ||
      !summary.key.trim() ||
      summary.key.length > MAX_ALIAS_LENGTH
    ) {
      throw new TypesafeJevError('invalid_jev_data_figure_summaries', 400);
    }
    if (
      !Object.hasOwn(summary, 'value') ||
      (typeof summary.value !== 'number' &&
        typeof summary.value !== 'boolean' &&
        summary.value !== null)
    ) {
      throw new TypesafeJevError('invalid_jev_data_figure_summaries', 400);
    }
    if (typeof summary.value === 'number' && !Number.isFinite(summary.value)) {
      throw new TypesafeJevError('invalid_jev_data_figure_summaries', 400);
    }
    if (Object.keys(summary).some((key) => !['key', 'value'].includes(key))) {
      throw new TypesafeJevError('invalid_jev_data_figure_summaries', 400);
    }
    return { key: summary.key.trim(), value: summary.value as number | boolean | null };
  });
  const goal = sanitizeCommonGoal(value.goal);
  const input = { fields, aggregateSummaries, goal } satisfies DataFigureRoutingInput;
  ensureRequestSize(input);
  return input;
}

export function buildDataFigureRoutingRequest(input: DataFigureRoutingInput) {
  const safe = sanitizeDataFigureRoutingInput(input);
  return {
    model: TYPESAFE_MODEL,
    state: {
      dataMetadata: safe,
      policy: {
        rawPatientRowsProvided: false,
        rawFreeTextCellsProvided: false,
        chooseOnlyServerOwnedTemplate: true,
      },
    },
    questions: {
      chart_template: choiceQuestion(
        'Choose the single best statistical figure template for dataMetadata. Do not infer patient-level records, compute new statistics, or invent missing fields.',
        DATA_CHART_TEMPLATE_IDS
      ),
    },
  };
}

export function sanitizeIllustrationCategoryInput(
  value: unknown
): IllustrationCategoryRoutingInput {
  if (!isRecord(value)) throw new TypesafeJevError('invalid_jev_illustration_request', 400);
  const researchIntent = sanitizeCommonGoal(value.researchIntent);
  const userCategory = value.userCategory === undefined ? undefined : value.userCategory;
  if (userCategory !== undefined && !isOneOf(userCategory, ILLUSTRATION_CATEGORY_IDS)) {
    throw new TypesafeJevError('invalid_jev_illustration_category', 400);
  }
  return { researchIntent, ...(userCategory ? { userCategory } : {}) };
}

export function buildIllustrationCategoryRequest(input: IllustrationCategoryRoutingInput) {
  const safe = sanitizeIllustrationCategoryInput(input);
  if (safe.userCategory) return null;
  return {
    model: TYPESAFE_MODEL,
    state: { researchIntent: safe.researchIntent, allowedCategories: ILLUSTRATION_CATEGORY_IDS },
    questions: {
      illustration_category: choiceQuestion(
        'Choose the best existing scientific illustration category for researchIntent. Do not create a new category and do not choose a journal style.',
        ILLUSTRATION_CATEGORY_IDS
      ),
    },
  };
}

export function sanitizeIllustrationJournalInput(value: unknown): IllustrationJournalRoutingInput {
  if (!isRecord(value)) throw new TypesafeJevError('invalid_jev_illustration_request', 400);
  const researchIntent = sanitizeCommonGoal(value.researchIntent);
  if (!isOneOf(value.category, ILLUSTRATION_CATEGORY_IDS))
    throw new TypesafeJevError('invalid_jev_illustration_category', 400);
  const userJournalStyle =
    value.userJournalStyle === undefined ? undefined : value.userJournalStyle;
  if (userJournalStyle !== undefined && !isOneOf(userJournalStyle, JOURNAL_STYLE_IDS)) {
    throw new TypesafeJevError('invalid_jev_journal_style', 400);
  }
  return {
    researchIntent,
    category: value.category,
    ...(userJournalStyle ? { userJournalStyle } : {}),
  };
}

export function buildIllustrationJournalRequest(input: IllustrationJournalRoutingInput) {
  const safe = sanitizeIllustrationJournalInput(input);
  if (safe.userJournalStyle) return null;
  return {
    model: TYPESAFE_MODEL,
    state: {
      researchIntent: safe.researchIntent,
      confirmedCategory: safe.category,
      allowedJournalStyles: JOURNAL_STYLE_IDS,
    },
    questions: {
      journal_style: choiceQuestion(
        'Choose the best visual journal preset for the confirmed illustration category and researchIntent. This is a visual preset, not a claim of journal compliance.',
        JOURNAL_STYLE_IDS
      ),
    },
  };
}

export function buildPromptCompletenessRequest(input: PromptCompletenessInput) {
  if (!isRecord(input) || !isOneOf(input.category, ILLUSTRATION_CATEGORY_IDS)) {
    throw new TypesafeJevError('invalid_jev_prompt_request', 400);
  }
  const prompt = sanitizeCommonGoal(input.prompt);
  return {
    model: TYPESAFE_MODEL,
    state: { prompt, confirmedCategory: input.category },
    questions: {
      prompt_completeness: choiceQuestion(
        'Assess whether prompt contains enough information for the chosen illustration category. Do not invent facts; choose unknown when evidence is insufficient.',
        ['complete', 'needs_revision']
      ),
    },
  };
}

function parseChoice(
  payload: unknown,
  questionId: string,
  allowed: readonly string[]
): FigureRoutingAnswer {
  if (!isRecord(payload) || !isRecord(payload.answers) || !isRecord(payload.answers[questionId])) {
    throw new TypesafeJevError('invalid_jev_figure_response', 502);
  }
  const answer = payload.answers[questionId] as Record<string, unknown>;
  const probabilities = answer.probabilities;
  if (
    answer.type !== 'choice' ||
    typeof answer.choice !== 'string' ||
    !isRecord(probabilities) ||
    typeof answer.confidence !== 'number' ||
    !Number.isFinite(answer.confidence) ||
    answer.confidence < 0 ||
    answer.confidence > 1 ||
    Object.keys(probabilities).length !== allowed.length + 1 ||
    [...allowed, 'unknown'].some(
      (key) =>
        typeof probabilities[key] !== 'number' ||
        !Number.isFinite(probabilities[key] as number) ||
        (probabilities[key] as number) < 0 ||
        (probabilities[key] as number) > 1
    ) ||
    ![...allowed, 'unknown'].includes(answer.choice)
  )
    throw new TypesafeJevError('invalid_jev_figure_response', 502);
  const sum = [...allowed, 'unknown'].reduce(
    (total, key) => total + (probabilities[key] as number),
    0
  );
  if (Math.abs(sum - 1) > 0.05) throw new TypesafeJevError('invalid_jev_figure_response', 502);
  return {
    type: 'choice',
    choice: answer.choice,
    probabilities: probabilities as Record<string, number>,
    confidence: answer.confidence,
  };
}

function toDecision<T extends string>(
  answer: FigureRoutingAnswer,
  allowed: readonly T[]
): FigureRoutingDecision<T> {
  const selected = isOneOf(answer.choice, allowed) ? answer.choice : 'unknown';
  const probability = selected === 'unknown' ? null : answer.probabilities[selected];
  const ranked = [...allowed].map((id) => answer.probabilities[id]).sort((a, b) => b - a);
  const needsReview =
    selected === 'unknown' ||
    (probability ?? 0) < MIN_SELECTED_PROBABILITY ||
    ranked[0] - (ranked[1] ?? 0) < MIN_MARGIN;
  return {
    selected,
    needsReview,
    probability,
    policyVersion: FIGURE_ROUTING_POLICY_VERSION,
    provider: 'typesafe',
    model: TYPESAFE_MODEL,
  };
}

export function parseDataFigureRoutingResponse(
  payload: unknown
): FigureRoutingDecision<DataChartTemplateId> {
  return toDecision(
    parseChoice(payload, 'chart_template', DATA_CHART_TEMPLATE_IDS),
    DATA_CHART_TEMPLATE_IDS
  );
}

export function parseIllustrationCategoryResponse(
  payload: unknown
): FigureRoutingDecision<IllustrationCategoryId> {
  return toDecision(
    parseChoice(payload, 'illustration_category', ILLUSTRATION_CATEGORY_IDS),
    ILLUSTRATION_CATEGORY_IDS
  );
}

export function parseIllustrationJournalResponse(
  payload: unknown
): FigureRoutingDecision<JournalStyleId> {
  return toDecision(parseChoice(payload, 'journal_style', JOURNAL_STYLE_IDS), JOURNAL_STYLE_IDS);
}

export function resolveUserChoice<T extends string>(
  choice: T | undefined,
  recommendation: FigureRoutingDecision<T>
): T | 'unknown' {
  return choice ?? recommendation.selected;
}

export async function requestTypesafeFigureRouting(
  request: unknown,
  fetchImpl: typeof fetch = fetch
): Promise<unknown> {
  const apiKey = process.env.TYPESAFE_API_KEY?.trim();
  if (!apiKey) throw new TypesafeJevError('typesafe_jev_unconfigured', 503);
  let response: Response;
  try {
    response = await fetchImpl(TYPESAFE_ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new TypesafeJevError('typesafe_jev_unavailable', 503);
  }
  if (!response.ok) throw new TypesafeJevError('typesafe_jev_failed', 502);
  try {
    return await response.json();
  } catch {
    throw new TypesafeJevError('typesafe_jev_invalid_response', 502);
  }
}
