import { describe, expect, it } from 'vitest';
import { getImageModelCapabilities } from './imageModelCapabilities';

describe('image model capability registry', () => {
  it.each([
    ['managed', 'nano-banana-pro', true, false],
    ['managed', 'gpt-image-2', true, true],
    ['google', 'imagen-4.0-generate-001', true, false],
    ['google', 'gemini-3-pro-image', true, true],
    ['openai', 'gpt-image-1', true, true],
    ['openai', 'dall-e-3', true, false],
    ['openai', 'unknown-image-model', true, false],
  ] as const)(
    'maps %s/%s to generation=%s editing=%s',
    (provider, modelId, generation, editing) => {
      expect(getImageModelCapabilities(provider, modelId)).toEqual({ generation, editing });
    }
  );
});
