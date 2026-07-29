import { describe, expect, it } from 'vitest';
import type { Settings } from '../../types';
import { resolveImageRoute, resolveTextRoute } from './capabilityRouting';

const base = (): Settings => ({ provider: 'openai' });

describe('capability-specific BYOK routing', () => {
  it('uses text BYOK without treating a missing image model as managed text', () => {
    const settings = {
      ...base(),
      openAIApiKey: 'key',
      openAITextModel: 'text-model',
      memberManagedTextEnabled: true,
    };
    expect(resolveTextRoute(settings, true)).toBe('byok');
    expect(resolveImageRoute(settings, 'gpt-image-2', true)).toBe('unavailable');
  });

  it('falls back only for the explicitly enabled managed image capability', () => {
    const settings = {
      ...base(),
      memberManagedNanoBananaEnabled: true,
      memberManagedGptImageEnabled: false,
    };
    expect(resolveImageRoute(settings, 'nano-banana-pro', true)).toBe('managed');
    expect(resolveImageRoute(settings, 'gpt-image-2', true)).toBe('unavailable');
  });

  it('recognizes a complete Anthropic Messages text configuration', () => {
    const settings: Settings = {
      provider: 'anthropic',
      anthropicApiKey: 'key',
      anthropicTextModel: 'claude-model',
    };
    expect(resolveTextRoute(settings, false)).toBe('byok');
  });
});
