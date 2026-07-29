import { describe, expect, it } from 'vitest';
import { assertGenerationRoute } from './generate';

describe('managed generation route matrix', () => {
  it.each([
    ['gemini-3.6-flash', 'analysis', undefined],
    ['gemini-3.6-flash', 'generation', '11111111-1111-4111-8111-111111111111'],
    ['gemini-3.6-flash', 'regeneration', undefined],
    ['gemini-3.6-flash', 'deep_update', undefined],
    ['gemini-3.6-flash', 'blind_review', undefined],
    ['nano-banana-pro', 'image_generation', undefined],
    ['gpt-image-2', 'image_generation', undefined],
  ] as const)('accepts %s + %s', (provider, operation, workflowId) => {
    expect(() => assertGenerationRoute(provider, operation, workflowId)).not.toThrow();
  });

  it.each([
    ['nano-banana-pro', 'analysis', undefined],
    ['gpt-image-2', 'generation', '11111111-1111-4111-8111-111111111111'],
    ['gemini-3.6-flash', 'generation', undefined],
    ['gemini-3.6-flash', 'analysis', '11111111-1111-4111-8111-111111111111'],
    ['nano-banana-pro', 'image_generation', '11111111-1111-4111-8111-111111111111'],
    ['gemini-3.6-flash', 'blind_review', '11111111-1111-4111-8111-111111111111'],
  ] as const)(
    'rejects %s + %s with an invalid workflow shape',
    (provider, operation, workflowId) => {
      expect(() => assertGenerationRoute(provider, operation, workflowId)).toThrowError(
        'invalid_generation_request'
      );
    }
  );
});
