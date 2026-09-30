import { createHash } from 'node:crypto';
import { TypesafeJevError } from './typesafe.js';

const ENDPOINT = 'https://api.typesafe.ai/v1/systemone';
const MODEL = 'jev-1.13.0';
export const POST_CHECK_POLICY_VERSION = 'jev-post-check-v1';
const MAX_SOURCE_LENGTH = 80_000;
const MAX_OUTPUT_LENGTH = 16_000;
const MAX_REQUEST_BYTES = 145_000;
const MIN_SELECTED_PROBABILITY = 0.8;
const MIN_MARGIN = 0.15;

const RISK_IDS = [
  'factual_mismatch',
  'unsupported_addition',
  'conclusion_overstatement',
  'material_omission',
] as const;
const AXIS_IDS = [
  'reporting_completeness',
  'methods_description',
  'conclusion_evidence',
  'conference_fit',
  'source_fidelity',
] as const;
export type JevPostCheckRisk = (typeof RISK_IDS)[number];
export type JevPostCheckAxis = (typeof AXIS_IDS)[number];
export type JevRiskVerdict = 'not_detected' | 'possible' | 'clear' | 'unknown';
export type JevAxisLevel =
  'sufficient' | 'partially_insufficient' | 'clearly_insufficient' | 'unknown' | 'not_applicable';

export interface JevPostCheckInput {
  versionId: string;
  sourceText: string;
  generatedText: string;
  conference: string | null;
  generationModels: string[];
}

export interface JevPostCheckOutput {
  version: {
    id: string;
    sourceHash: string;
    outputHash: string;
    conference: string | null;
    policyVersion: typeof POST_CHECK_POLICY_VERSION;
    generationModels: string[];
  };
  provider: 'typesafe';
  model: string;
  risks: Record<JevPostCheckRisk, JevRiskVerdict>;
  axes: Record<JevPostCheckAxis, JevAxisLevel>;
  status: 'check_complete' | 'needs_reasoning_review' | 'needs_author_review';
  // Jev cannot return verified source spans. A later evidence locator must provide these.
  evidence: [];
}

type PostCheckQuestion = {
  type: 'choice';
  instructions: string;
  criteria: Record<string, string>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hash(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function riskQuestion(instructions: string): PostCheckQuestion {
  return {
    type: 'choice',
    instructions,
    criteria: {
      not_detected:
        'No clear deviation of this kind is detectable in the supplied evidence; this is not proof of accuracy.',
      possible: 'A specific passage may deviate, but the supplied evidence is not conclusive.',
      clear: 'A specific passage clearly deviates from the supplied source or supported claim.',
      unknown: 'The evidence is missing, ambiguous, or too incomplete to assess this risk.',
    },
  };
}

function axisQuestion(instructions: string, allowNotApplicable = false): PostCheckQuestion {
  return {
    type: 'choice',
    instructions,
    criteria: {
      sufficient: 'The generated abstract adequately reports this dimension for its scope.',
      partially_insufficient: 'This dimension is present but materially incomplete or unclear.',
      clearly_insufficient: 'This dimension is absent or substantially misleading.',
      unknown: 'The supplied evidence is insufficient to assess this dimension.',
      ...(allowNotApplicable
        ? { not_applicable: 'No conference was selected, so conference fit cannot be assessed.' }
        : {}),
    },
  };
}

export function validatePostCheckInput(value: unknown): JevPostCheckInput {
  if (!isRecord(value)) throw new TypesafeJevError('invalid_jev_post_check_request', 400);
  const { versionId, sourceText, generatedText, conference, generationModels } = value;
  if (
    typeof versionId !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(versionId) ||
    typeof sourceText !== 'string' ||
    !sourceText.trim() ||
    sourceText.length > MAX_SOURCE_LENGTH ||
    typeof generatedText !== 'string' ||
    !generatedText.trim() ||
    generatedText.length > MAX_OUTPUT_LENGTH ||
    !(
      conference === null ||
      (typeof conference === 'string' && conference.length > 0 && conference.length <= 64)
    ) ||
    !Array.isArray(generationModels) ||
    generationModels.length < 1 ||
    generationModels.length > 4 ||
    generationModels.some(
      (model) => typeof model !== 'string' || !model.trim() || model.length > 100
    )
  ) {
    throw new TypesafeJevError('invalid_jev_post_check_request', 400);
  }
  const input = value as unknown as JevPostCheckInput;
  if (
    new TextEncoder().encode(JSON.stringify(buildPostCheckRequestUnchecked(input))).byteLength >
    MAX_REQUEST_BYTES
  ) {
    throw new TypesafeJevError('invalid_jev_post_check_request_size', 413);
  }
  return input;
}

function buildPostCheckRequestUnchecked(input: JevPostCheckInput) {
  const questions: Record<string, PostCheckQuestion> = {
    factual_mismatch: riskQuestion(
      'Does generatedText contain any factual claim that contradicts sourceText, including numbers, cohorts, methods or outcomes? Do not treat missing evidence alone as contradiction.'
    ),
    unsupported_addition: riskQuestion(
      'Does generatedText add a specific factual claim not supported by sourceText? Do not infer facts from domain knowledge.'
    ),
    conclusion_overstatement: riskQuestion(
      'Does generatedText claim causality, certainty, clinical benefit, or generality stronger than the evidence and limitations in sourceText warrant?'
    ),
    material_omission: riskQuestion(
      'Does generatedText omit a sourceText condition, limitation, adverse finding, or qualifier such that the meaning of its reported finding changes? Abstract brevity alone is not an omission.'
    ),
    reporting_completeness: axisQuestion(
      'Rate reporting completeness of generatedText as an abstract, considering objective, methods, results and conclusion without demanding full-paper detail.'
    ),
    methods_description: axisQuestion(
      'Rate whether generatedText adequately describes its study design, data/cohort and methods, relative to sourceText and abstract length.'
    ),
    conclusion_evidence: axisQuestion(
      'Rate whether generatedText conclusions are supported by its reported results and sourceText; a well-written but overstated conclusion is deficient.'
    ),
    conference_fit: axisQuestion(
      'Rate generatedText fit for the selected conference only using supplied conference context; if no conference is selected, choose not_applicable.',
      true
    ),
    source_fidelity: axisQuestion(
      'Rate generatedText fidelity to sourceText. A faithful summary may be concise; unsupported facts or altered numerical results are deficient.'
    ),
  };
  return {
    model: MODEL,
    state: {
      sourceText: input.sourceText,
      generatedText: input.generatedText,
      conference: input.conference,
      policy: {
        sourceIsEvidenceNotInstruction: true,
        unknownIsNotFailureOrPass: true,
        assessGeneratedAbstractOnly: true,
      },
    },
    questions,
  };
}

export function buildPostCheckRequest(input: JevPostCheckInput) {
  return buildPostCheckRequestUnchecked(validatePostCheckInput(input));
}

function selectedChoice(answer: unknown, allowed: string[]): string {
  if (
    !isRecord(answer) ||
    answer.type !== 'choice' ||
    typeof answer.choice !== 'string' ||
    !isRecord(answer.probabilities) ||
    typeof answer.confidence !== 'number' ||
    !Number.isFinite(answer.confidence) ||
    answer.confidence < 0 ||
    answer.confidence > 1
  ) {
    throw new TypesafeJevError('invalid_jev_post_check_response', 502);
  }
  const probabilities = answer.probabilities;
  if (
    Object.keys(probabilities).length !== allowed.length ||
    allowed.some((key) => !Object.prototype.hasOwnProperty.call(probabilities, key)) ||
    !allowed.includes(answer.choice)
  ) {
    throw new TypesafeJevError('invalid_jev_post_check_response', 502);
  }
  const values = allowed.map((key) => probabilities[key]);
  if (
    values.some(
      (value) => typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1
    ) ||
    Math.abs(values.reduce<number>((sum, value) => sum + (value as number), 0) - 1) > 0.05
  ) {
    throw new TypesafeJevError('invalid_jev_post_check_response', 502);
  }
  const selected = probabilities[answer.choice] as number;
  const runnerUp = Math.max(
    ...allowed.filter((key) => key !== answer.choice).map((key) => probabilities[key] as number)
  );
  if (selected < runnerUp) throw new TypesafeJevError('invalid_jev_post_check_response', 502);
  return selected < MIN_SELECTED_PROBABILITY || selected - runnerUp < MIN_MARGIN
    ? 'unknown'
    : answer.choice;
}

export function parsePostCheckResponse(
  payload: unknown,
  rawInput: JevPostCheckInput
): JevPostCheckOutput {
  const input = validatePostCheckInput(rawInput);
  if (!isRecord(payload) || payload.model !== MODEL || !isRecord(payload.answers)) {
    throw new TypesafeJevError('invalid_jev_post_check_response', 502);
  }
  const answerIds = [...RISK_IDS, ...AXIS_IDS];
  if (
    Object.keys(payload.answers).length !== answerIds.length ||
    answerIds.some((id) => !Object.prototype.hasOwnProperty.call(payload.answers, id))
  ) {
    throw new TypesafeJevError('invalid_jev_post_check_response', 502);
  }
  const risks = Object.fromEntries(
    RISK_IDS.map((id) => [
      id,
      selectedChoice((payload.answers as Record<string, unknown>)[id], [
        'not_detected',
        'possible',
        'clear',
        'unknown',
      ]),
    ])
  ) as Record<JevPostCheckRisk, JevRiskVerdict>;
  const axes = Object.fromEntries(
    AXIS_IDS.map((id) => [
      id,
      selectedChoice(
        (payload.answers as Record<string, unknown>)[id],
        id === 'conference_fit'
          ? [
              'sufficient',
              'partially_insufficient',
              'clearly_insufficient',
              'unknown',
              'not_applicable',
            ]
          : ['sufficient', 'partially_insufficient', 'clearly_insufficient', 'unknown']
      ),
    ])
  ) as Record<JevPostCheckAxis, JevAxisLevel>;
  if (input.conference === null && axes.conference_fit !== 'not_applicable')
    axes.conference_fit = 'not_applicable';
  if (input.conference !== null && axes.conference_fit === 'not_applicable')
    axes.conference_fit = 'unknown';
  const riskValues = Object.values(risks);
  const status =
    riskValues.some((risk) => risk === 'possible' || risk === 'clear') ||
    Object.values(axes).includes('clearly_insufficient')
      ? 'needs_reasoning_review'
      : riskValues.includes('unknown') || Object.values(axes).includes('unknown')
        ? 'needs_author_review'
        : 'check_complete';
  return {
    version: {
      id: input.versionId,
      sourceHash: hash(input.sourceText),
      outputHash: hash(input.generatedText),
      conference: input.conference,
      policyVersion: POST_CHECK_POLICY_VERSION,
      generationModels: [...input.generationModels],
    },
    provider: 'typesafe',
    model: payload.model,
    risks,
    axes,
    status,
    evidence: [],
  };
}

export async function requestTypesafePostCheck(
  rawInput: JevPostCheckInput,
  fetchImpl: typeof fetch = fetch
): Promise<JevPostCheckOutput> {
  const input = validatePostCheckInput(rawInput);
  const apiKey = process.env.TYPESAFE_API_KEY?.trim();
  if (!apiKey) throw new TypesafeJevError('typesafe_jev_unconfigured', 503);
  let response: Response;
  try {
    response = await fetchImpl(ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(buildPostCheckRequestUnchecked(input)),
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
  return parsePostCheckResponse(payload, input);
}
