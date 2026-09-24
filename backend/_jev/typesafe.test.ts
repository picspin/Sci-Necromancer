import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildJevAnalysisRequest,
  parseJevAnalysisResponse,
  requestTypesafeJev,
  sanitizeJevAnalysisInput,
} from './typesafe';

const input = sanitizeJevAnalysisInput({
  text: 'We evaluated a compressed-sensing MRI reconstruction method in 42 volunteers.',
  conference: 'ISMRM',
  categories: [
    { name: 'Acquisition Methods', type: 'main' },
    { name: 'Image Reconstruction', type: 'main' },
  ],
  keywords: ['MRI', 'Compressed Sensing', 'Cardiology'],
});

describe('TypeSafe Jev analysis adapter', () => {
  afterEach(() => {
    delete process.env.TYPESAFE_API_KEY;
  });
  it('builds one structured request with independent typed questions', () => {
    const request = buildJevAnalysisRequest(input);

    expect(request.model).toBe('jev-1.13.0');
    expect(request.state).toMatchObject({
      conference: 'ISMRM',
      candidateCategories: input.categories,
      candidateKeywords: input.keywords,
    });
    expect(request.questions).toHaveProperty('is_scientific_submission');
    expect(request.questions).toHaveProperty('category_0');
    expect(request.questions).toHaveProperty('keyword_0');
    expect(request.questions.category_0.type).toBe('noul');
  });

  it('keeps candidate labels code-owned and marks uncertain output for fallback', () => {
    const parsed = parseJevAnalysisResponse(
      {
        model: 'jev-1.13.0',
        answers: {
          is_scientific_submission: { type: 'noul', noul: 0.92 },
          has_objective: { type: 'noul', noul: 0.9 },
          has_methods: { type: 'noul', noul: 0.9 },
          has_results: { type: 'noul', noul: 0.55 },
          has_conclusion: { type: 'noul', noul: 0.45 },
          category_0: { type: 'noul', noul: 0.88 },
          category_1: { type: 'noul', noul: 0.2 },
          keyword_0: { type: 'noul', noul: 0.9 },
          keyword_1: { type: 'noul', noul: 0.72 },
          keyword_2: { type: 'noul', noul: 0.05 },
        },
      },
      input
    );

    expect(parsed.analysis.categories).toEqual([
      { name: 'Acquisition Methods', type: 'main', probability: 0.88 },
    ]);
    expect(parsed.analysis.keywords).toEqual(['MRI', 'Compressed Sensing']);
    expect(parsed.preflight.needsReview).toBe(false);
    expect(parsed.analysis.categories.some(({ name }) => name === 'invented')).toBe(false);
  });

  it.each([
    [
      'missing expected answer',
      (payload: ReturnType<typeof validPayload>) => delete payload.answers.has_methods,
    ],
    [
      'wrong answer type',
      (payload: ReturnType<typeof validPayload>) => {
        payload.answers.has_methods.type = 'choice';
      },
    ],
    [
      'missing noul',
      (payload: ReturnType<typeof validPayload>) => delete payload.answers.has_methods.noul,
    ],
    [
      'NaN noul',
      (payload: ReturnType<typeof validPayload>) => {
        payload.answers.has_methods.noul = Number.NaN;
      },
    ],
    [
      'infinite noul',
      (payload: ReturnType<typeof validPayload>) => {
        payload.answers.has_methods.noul = Infinity;
      },
    ],
    [
      'out-of-range noul',
      (payload: ReturnType<typeof validPayload>) => {
        payload.answers.has_methods.noul = 1.1;
      },
    ],
    [
      'string noul',
      (payload: ReturnType<typeof validPayload>) => {
        payload.answers.has_methods.noul = '0.9' as unknown as number;
      },
    ],
    [
      'missing model',
      (payload: ReturnType<typeof validPayload>) => {
        delete payload.model;
      },
    ],
    [
      'empty model',
      (payload: ReturnType<typeof validPayload>) => {
        payload.model = '';
      },
    ],
    [
      'unexpected model',
      (payload: ReturnType<typeof validPayload>) => {
        payload.model = 'another-model';
      },
    ],
    [
      'extra answer ID',
      (payload: ReturnType<typeof validPayload>) => {
        payload.answers.unexpected = { type: 'noul', noul: 0.5 };
      },
    ],
  ])('rejects a %s provider response', (_description, mutate) => {
    const payload = validPayload();
    mutate(payload);
    expect(() => parseJevAnalysisResponse(payload, input)).toThrow('invalid_jev_analysis_response');
  });

  it('accepts low probabilities and records uncertainty', () => {
    const payload = validPayload(0.1);
    const parsed = parseJevAnalysisResponse(payload, input);
    expect(parsed.preflight.needsReview).toBe(true);
    expect(parsed.model).toBe('jev-1.13.0');
    expect(parsed.analysis.categories).toHaveLength(2);
    expect(parsed.analysis.keywords).toHaveLength(3);
  });

  it('validates answers below selection thresholds too', () => {
    const payload = validPayload(0.1);
    payload.answers.category_0 = { type: 'choice', noul: 0.1 };
    expect(() => parseJevAnalysisResponse(payload, input)).toThrow('invalid_jev_analysis_response');
  });

  it('uses the fixed official endpoint and validates the returned model identity', async () => {
    process.env.TYPESAFE_API_KEY = 'test-key';
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => validPayload() });
    await expect(requestTypesafeJev(input, fetchMock)).resolves.toMatchObject({
      model: 'jev-1.13.0',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.typesafe.ai/v1/systemone',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer test-key' }),
      })
    );
  });

  it.each([
    [
      'a network failure',
      vi.fn().mockRejectedValue(new Error('offline')),
      'typesafe_jev_unavailable',
    ],
    ['a non-OK response', vi.fn().mockResolvedValue({ ok: false }), 'typesafe_jev_failed'],
    [
      'malformed JSON',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => {
          throw new Error('bad json');
        },
      }),
      'typesafe_jev_invalid_response',
    ],
  ])('preserves failure behavior for %s', async (_description, fetchMock, code) => {
    process.env.TYPESAFE_API_KEY = 'test-key';
    await expect(requestTypesafeJev(input, fetchMock)).rejects.toThrow(code);
  });

  it.each([
    [
      'a partially invalid category array',
      {
        ...validInput(),
        categories: [
          { name: 'Valid', type: 'main' },
          { name: 4, type: 'main' },
        ],
      },
    ],
    [
      'duplicate category names',
      {
        ...validInput(),
        categories: [
          { name: 'Valid', type: 'main' },
          { name: 'Valid', type: 'sub' },
        ],
      },
    ],
    [
      'wrong category type',
      {
        ...validInput(),
        categories: [
          { name: 'Valid', type: 'invalid' },
          { name: 'Other', type: 'main' },
        ],
      },
    ],
    [
      'a boxed category type',
      {
        ...validInput(),
        categories: [
          { name: 'Valid', type: new String('main') },
          { name: 'Other', type: 'main' },
        ],
      },
    ],
    [
      'empty category label',
      {
        ...validInput(),
        categories: [
          { name: '', type: 'main' },
          { name: 'Other', type: 'main' },
        ],
      },
    ],
    [
      'oversized category label',
      {
        ...validInput(),
        categories: [
          { name: 'a'.repeat(161), type: 'main' },
          { name: 'Other', type: 'main' },
        ],
      },
    ],
    ['a nonstring keyword', { ...validInput(), keywords: ['valid', 4] }],
    ['empty keyword label', { ...validInput(), keywords: ['valid', ''] }],
    ['oversized keyword label', { ...validInput(), keywords: ['valid', 'a'.repeat(161)] }],
    ['an oversized conference', { ...validInput(), conference: 'a'.repeat(65) }],
    [
      'too many categories',
      {
        ...validInput(),
        categories: Array.from({ length: 65 }, (_, index) => ({
          name: `Category ${index}`,
          type: 'main',
        })),
      },
    ],
    [
      'too many keywords',
      { ...validInput(), keywords: Array.from({ length: 65 }, (_, index) => `Keyword ${index}`) },
    ],
    ['a source exceeding the UTF-8 request budget', { ...validInput(), text: '界'.repeat(40_001) }],
  ])('rejects %s', (_description, candidate) => {
    expect(() => sanitizeJevAnalysisInput(candidate)).toThrow('invalid_jev_analysis');
  });
});

function validInput() {
  return {
    text: 'Source text',
    conference: 'ISMRM',
    categories: [
      { name: 'Category One', type: 'main' },
      { name: 'Category Two', type: 'sub' },
    ],
    keywords: ['Keyword One', 'Keyword Two'],
  };
}

function validPayload(probability = 0.9) {
  return {
    model: 'jev-1.13.0',
    answers: {
      is_scientific_submission: { type: 'noul', noul: probability },
      has_objective: { type: 'noul', noul: probability },
      has_methods: { type: 'noul', noul: probability },
      has_results: { type: 'noul', noul: probability },
      has_conclusion: { type: 'noul', noul: probability },
      category_0: { type: 'noul', noul: probability },
      category_1: { type: 'noul', noul: probability },
      keyword_0: { type: 'noul', noul: probability },
      keyword_1: { type: 'noul', noul: probability },
      keyword_2: { type: 'noul', noul: probability },
    } as Record<string, { type: string; noul?: number }>,
  };
}
