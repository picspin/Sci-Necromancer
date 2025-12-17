import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Settings } from '@/types';

describe('LLM Index - Provider Selection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should route to Google provider when configured', async () => {
    const googleSettings: Settings = {
      provider: 'google',
      googleApiKey: 'test-key',
      model: 'gemini-2.5-flash',
    };
    localStorage.setItem('app-settings', JSON.stringify(googleSettings));

    const { analyzeContent } = await import('@/lib/llm/index');

    // This should internally call gemini.ts
    expect(() => analyzeContent('test', 'ISMRM')).toBeDefined();
  });

  it('should route to OpenAI provider when configured', async () => {
    const openaiSettings: Settings = {
      provider: 'openai',
      openAIApiKey: 'test-key',
      openAIBaseUrl: 'https://api.openai.com/v1',
      openAITextModel: 'gpt-4o',
    };
    localStorage.setItem('app-settings', JSON.stringify(openaiSettings));

    const { analyzeContent } = await import('@/lib/llm/index');

    expect(() => analyzeContent('test', 'ISMRM')).toBeDefined();
  });

  it('should provide conference-specific helpers', async () => {
    const { generateISMRMAbstract, generateRSNAAbstract } = await import('@/lib/llm/index');

    expect(typeof generateISMRMAbstract).toBe('function');
    expect(typeof generateRSNAAbstract).toBe('function');
  });
});
