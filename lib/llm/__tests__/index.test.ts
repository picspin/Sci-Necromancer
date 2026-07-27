import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Settings } from '@/types';
import { acceptAIDisclosure } from '@/lib/compliance/aiDisclosure';

const { generateContentMock } = vi.hoisted(() => ({ generateContentMock: vi.fn() }));
vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    models = { generateContent: generateContentMock };
  },
}));

describe('LLM Index - Provider Selection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    acceptAIDisclosure();
    generateContentMock.mockResolvedValue({
      text: JSON.stringify({ categories: [], keywords: [] }),
    });
  });

  it('should route to Google provider when configured', async () => {
    const googleSettings: Settings = {
      provider: 'google',
      googleApiKey: 'test-key',
      model: 'gemini-2.5-flash',
    };
    localStorage.setItem('app-settings', JSON.stringify(googleSettings));

    const { analyzeContent } = await import('@/lib/llm/index');

    await expect(analyzeContent('test')).resolves.toBeDefined();
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

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '{"categories":[],"keywords":[]}' } }],
      }),
    });
    await expect(analyzeContent('test')).resolves.toBeDefined();
  });

  it('should provide conference-specific helpers', async () => {
    const { generateAbstractForConference, generateCreativeAbstractForConference } =
      await import('@/lib/llm/index');

    expect(typeof generateAbstractForConference).toBe('function');
    expect(typeof generateCreativeAbstractForConference).toBe('function');
  });

  it('preserves the education contract when RSNA generation is called without route metadata', async () => {
    localStorage.setItem(
      'app-settings',
      JSON.stringify({ provider: 'google', googleApiKey: 'test-key', model: 'gemini-2.5-flash' })
    );
    generateContentMock.mockResolvedValue({
      text: JSON.stringify({
        abstract: 'Teaching Points: Test. Table of Contents: Test.',
        impact: 'Educational impact.',
        synopsis: 'Synopsis.',
        keywords: ['MRI'],
      }),
    });
    const { generateAbstractForConference } = await import('@/lib/llm/index');

    const result = await generateAbstractForConference(
      'Teaching material',
      'RSNA Education Exhibit',
      [{ name: 'Neuroradiology', type: 'main', probability: 1 }],
      ['MRI', 'Education/Training', 'Validation Studies'],
      'RSNA'
    );

    expect(result.rsna?.contentType).toBe('education');
    expect(generateContentMock.mock.calls.at(-1)?.[0].contents).toContain(
      'CONTENT TYPE: education'
    );
  });
});
