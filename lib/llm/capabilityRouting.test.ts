import { describe, expect, it } from 'vitest';
import type { Settings } from '../../types';
import { resolveBlindReviewRoute, resolveImageRoute, resolveTextRoute } from './capabilityRouting';

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

  it('honors an explicit managed text choice even when BYOK is configured', () => {
    const settings: Settings = {
      ...base(),
      openAIApiKey: 'key',
      openAITextModel: 'text-model',
      memberManagedTextEnabled: true,
      textGenerationSource: 'managed',
      memberManagedTextModel: 'gpt-5.6-luna',
    };

    expect(resolveTextRoute(settings, true)).toBe('managed');
  });

  it('honors an explicit BYOK text choice when membership is also available', () => {
    const settings: Settings = {
      ...base(),
      openAIApiKey: 'key',
      openAITextModel: 'text-model',
      memberManagedTextEnabled: true,
      textGenerationSource: 'byok',
    };

    expect(resolveTextRoute(settings, true)).toBe('byok');
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

  it('enables the managed blind-review route for the research agent without the general text toggle', () => {
    const settings: Settings = {
      provider: 'openai',
      memberManagedTextEnabled: false,
      capabilities: {
        skillsEnabled: true,
        mcpEnabled: true,
        bundledBlindReviewSkill: true,
        managedEnabledIds: ['mga-pubmed', 'mga-research-verification-agent'],
        imported: [],
      },
    };

    expect(resolveTextRoute(settings, true)).toBe('unavailable');
    expect(resolveBlindReviewRoute(settings, true)).toBe('managed');
  });
});
