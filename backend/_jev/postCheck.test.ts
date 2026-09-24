import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildPostCheckRequest,
  parsePostCheckResponse,
  requestTypesafePostCheck,
  validatePostCheckInput,
  type JevPostCheckInput,
} from './postCheck';

const input: JevPostCheckInput = {
  versionId: '9f548c0a-0b40-4d23-8f68-57103ba1e6b4',
  sourceText:
    'In a cohort of 42 adults, we measured MRI reconstruction time. The median was 4 minutes. No clinical outcomes were measured.',
  generatedText: 'In 42 adults, MRI reconstruction took a median of 4 minutes.',
  conference: 'ISMRM',
  generationModels: ['glm-5.2'],
};

function choice(options: string[], selected: string, probability = 0.94) {
  const remainder = (1 - probability) / (options.length - 1);
  return {
    type: 'choice',
    choice: selected,
    probabilities: Object.fromEntries(
      options.map((option) => [option, option === selected ? probability : remainder])
    ),
    confidence: 0.85,
  };
}

function payload() {
  const questions = buildPostCheckRequest(input).questions;
  return {
    model: 'jev-1.13.0',
    answers: Object.fromEntries(
      Object.entries(questions).map(([id, question]) => [
        id,
        choice(
          Object.keys(question.criteria),
          id === 'conference_fit'
            ? 'sufficient'
            : id === 'source_fidelity'
              ? 'sufficient'
              : id.includes('_') &&
                  [
                    'factual_mismatch',
                    'unsupported_addition',
                    'conclusion_overstatement',
                    'material_omission',
                  ].includes(id)
                ? 'not_detected'
                : 'sufficient'
        ),
      ])
    ) as Record<string, ReturnType<typeof choice>>,
  };
}

describe('Jev generated-abstract post-check contract', () => {
  afterEach(() => {
    delete process.env.TYPESAFE_API_KEY;
  });

  it('binds a full source and frozen output to one set of independent questions', () => {
    const request = buildPostCheckRequest(input);
    expect(request.model).toBe('jev-1.13.0');
    expect(request.state).toMatchObject({
      sourceText: input.sourceText,
      generatedText: input.generatedText,
    });
    expect(Object.keys(request.questions)).toHaveLength(9);
    expect(request.questions.material_omission.type).toBe('choice');
    expect(request.questions.source_fidelity.criteria).toHaveProperty('unknown');
  });

  it('keeps score labels ordinal and never invents source citations', () => {
    const result = parsePostCheckResponse(payload(), input);
    expect(result.status).toBe('check_complete');
    expect(result.evidence).toEqual([]);
    expect(result.version).toEqual({
      id: input.versionId,
      sourceHash: createHash('sha256').update(input.sourceText).digest('hex'),
      outputHash: createHash('sha256').update(input.generatedText).digest('hex'),
      conference: 'ISMRM',
      policyVersion: 'jev-post-check-v1',
      generationModels: ['glm-5.2'],
    });
  });

  it('requests one reasoning review for clear or possible problems', () => {
    const response = payload();
    response.answers.unsupported_addition = choice(
      Object.keys(buildPostCheckRequest(input).questions.unsupported_addition.criteria),
      'possible'
    );
    expect(parsePostCheckResponse(response, input).status).toBe('needs_reasoning_review');
  });

  it('routes a clearly deficient rubric dimension to reasoning review', () => {
    const response = payload();
    response.answers.methods_description = choice(
      Object.keys(buildPostCheckRequest(input).questions.methods_description.criteria),
      'clearly_insufficient'
    );
    expect(parsePostCheckResponse(response, input).status).toBe('needs_reasoning_review');
  });

  it('marks low confidence and unassessable evidence as review, never pass', () => {
    const response = payload();
    response.answers.factual_mismatch = choice(
      Object.keys(buildPostCheckRequest(input).questions.factual_mismatch.criteria),
      'not_detected',
      0.55
    );
    const result = parsePostCheckResponse(response, input);
    expect(result.risks.factual_mismatch).toBe('unknown');
    expect(result.status).toBe('needs_author_review');
  });

  it('uses not applicable only when no conference is selected', () => {
    const noConference = { ...input, conference: null };
    const response = payload();
    response.answers.conference_fit = choice(
      Object.keys(buildPostCheckRequest(input).questions.conference_fit.criteria),
      'sufficient'
    );
    expect(parsePostCheckResponse(response, noConference).axes.conference_fit).toBe(
      'not_applicable'
    );
    response.answers.conference_fit = choice(
      Object.keys(buildPostCheckRequest(input).questions.conference_fit.criteria),
      'not_applicable'
    );
    expect(parsePostCheckResponse(response, input).axes.conference_fit).toBe('unknown');
  });

  it.each([
    [
      'missing answer',
      (response: ReturnType<typeof payload>) => delete response.answers.material_omission,
    ],
    [
      'wrong answer type',
      (response: ReturnType<typeof payload>) => {
        response.answers.factual_mismatch.type = 'noul';
      },
    ],
    [
      'unknown option',
      (response: ReturnType<typeof payload>) => {
        response.answers.factual_mismatch.choice = 'approved';
      },
    ],
    [
      'non-finite probability',
      (response: ReturnType<typeof payload>) => {
        response.answers.factual_mismatch.probabilities.clear = Number.NaN;
      },
    ],
    [
      'probability mass error',
      (response: ReturnType<typeof payload>) => {
        response.answers.factual_mismatch.probabilities.clear = 0.8;
      },
    ],
    [
      'fabricated answer id',
      (response: ReturnType<typeof payload>) => {
        response.answers.extra = response.answers.factual_mismatch;
      },
    ],
    [
      'unexpected model version',
      (response: ReturnType<typeof payload>) => {
        response.model = 'jev-latest';
      },
    ],
  ])('rejects %s', (_label, mutate) => {
    const response = payload();
    mutate(response);
    expect(() => parsePostCheckResponse(response, input)).toThrow(
      'invalid_jev_post_check_response'
    );
  });

  it.each([
    { ...input, sourceText: '' },
    { ...input, generatedText: 'x'.repeat(16_001) },
    { ...input, sourceText: '界'.repeat(60_000) },
    { ...input, versionId: 'not-a-uuid' },
    { ...input, generationModels: [] },
  ])('rejects unsafe or incomplete input', (candidate) => {
    expect(() => validatePostCheckInput(candidate)).toThrow('invalid_jev_post_check_request');
  });

  it('calls only the official endpoint and preserves returned model', async () => {
    process.env.TYPESAFE_API_KEY = 'test-key';
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => payload() });
    const result = await requestTypesafePostCheck(input, fetchMock);
    expect(result.model).toBe('jev-1.13.0');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.typesafe.ai/v1/systemone',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer test-key' }),
      })
    );
  });

  it('does not call provider without a configured server-side key', async () => {
    const fetchMock = vi.fn();
    await expect(requestTypesafePostCheck(input, fetchMock)).rejects.toThrow(
      'typesafe_jev_unconfigured'
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
