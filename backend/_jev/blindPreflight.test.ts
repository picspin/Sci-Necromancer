import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildBlindPreflightRequest,
  parseBlindPreflightResponse,
  requestTypesafeBlindPreflight,
  validateBlindPreflightInput,
  type JevBlindPreflightInput,
} from './blindPreflight';

const input: JevBlindPreflightInput = {
  sourceText:
    'We retrospectively reviewed 42 adults. MRI reconstruction time was measured, but no clinical outcome was collected.',
  conference: 'ISMRM',
  conferenceRules: 'Use a structured abstract and disclose study limitations.',
  target: 'manuscript',
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

function payload(selected = 'not_detected') {
  const questions = buildBlindPreflightRequest(input).questions;
  return {
    model: 'jev-1.13.0',
    answers: Object.fromEntries(
      Object.entries(questions).map(([id, question]) => [
        id,
        choice(Object.keys(question.criteria), id === 'methodology' ? 'possible' : selected),
      ])
    ),
  };
}

describe('Jev blind-review preflight contract', () => {
  afterEach(() => {
    delete process.env.TYPESAFE_API_KEY;
  });

  it('builds an advisory request with the complete manuscript context and fixed model', () => {
    const request = buildBlindPreflightRequest(input);
    expect(request.model).toBe('jev-1.13.0');
    expect(request.state).toMatchObject({
      sourceText: input.sourceText,
      conference: 'ISMRM',
      target: 'manuscript',
    });
    expect(request.state.policy).toMatchObject({
      preflightIsAdvisory: true,
      fullReasoningReviewRequired: true,
      noCitationVerification: true,
    });
    expect(Object.keys(request.questions)).toHaveLength(7);
  });

  it('returns only typed flags and always requires the full reviewer', () => {
    const result = parseBlindPreflightResponse(payload(), input);
    expect(result.provider).toBe('typesafe');
    expect(result.needsFullReview).toBe(true);
    expect(result.evidence).toEqual([]);
    expect(result.flags.methodology).toBe('possible');
    expect(result.flags.ethics_and_consent).toBe('not_detected');
  });

  it('keeps uncertainty instead of turning a weak Jev answer into a finding', () => {
    const response = payload();
    response.answers.methodology = choice(
      Object.keys(buildBlindPreflightRequest(input).questions.methodology.criteria),
      'clear',
      0.55
    );
    expect(parseBlindPreflightResponse(response, input).flags.methodology).toBe('unknown');
  });

  it.each([
    [
      'missing dimension',
      (response: ReturnType<typeof payload>) => delete response.answers.methodology,
    ],
    [
      'wrong answer type',
      (response: ReturnType<typeof payload>) => {
        response.answers.ethics_and_consent.type = 'noul';
      },
    ],
    [
      'unknown option',
      (response: ReturnType<typeof payload>) => {
        response.answers.data_integrity.choice = 'approved';
      },
    ],
    [
      'extra answer',
      (response: ReturnType<typeof payload>) => {
        response.answers.extra = response.answers.ethics_and_consent;
      },
    ],
    [
      'wrong model',
      (response: ReturnType<typeof payload>) => {
        response.model = 'jev-latest';
      },
    ],
  ])('rejects %s provider responses', (_label, mutate) => {
    const response = payload();
    mutate(response);
    expect(() => parseBlindPreflightResponse(response, input)).toThrow(
      'invalid_jev_blind_preflight_response'
    );
  });

  it.each([
    { ...input, sourceText: '' },
    { ...input, conference: '' },
    { ...input, target: 'review' as never },
    { ...input, sourceText: 'x'.repeat(80_001) },
  ])('rejects unsafe input', (candidate) => {
    expect(() => validateBlindPreflightInput(candidate)).toThrow(
      'invalid_jev_blind_preflight_request'
    );
  });

  it('calls only the official endpoint with the server-side key', async () => {
    process.env.TYPESAFE_API_KEY = 'test-key';
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => payload() });
    await expect(requestTypesafeBlindPreflight(input, fetchMock)).resolves.toMatchObject({
      provider: 'typesafe',
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

  it('does not call the provider without a configured server-side key', async () => {
    const fetchMock = vi.fn();
    await expect(requestTypesafeBlindPreflight(input, fetchMock)).rejects.toThrow(
      'typesafe_jev_unconfigured'
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
