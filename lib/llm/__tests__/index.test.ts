import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Settings } from '@/types';
import { acceptAIDisclosure } from '@/lib/compliance/aiDisclosure';

const { generateContentMock, generateManagedTextMock, canUseManagedTextMock } = vi.hoisted(() => ({
  generateContentMock: vi.fn(),
  generateManagedTextMock: vi.fn(),
  canUseManagedTextMock: vi.fn(),
}));
vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    models = { generateContent: generateContentMock };
  },
}));
vi.mock('@/src/composables/useMembership', () => ({
  canUseManagedText: canUseManagedTextMock,
  generateManagedText: generateManagedTextMock,
}));

describe('LLM Index - Provider Selection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    localStorage.clear();
    acceptAIDisclosure();
    canUseManagedTextMock.mockReturnValue(true);
    generateContentMock.mockResolvedValue({
      text: JSON.stringify({ categories: [], keywords: [] }),
    });
    generateManagedTextMock.mockResolvedValue({
      text: JSON.stringify({ categories: [], keywords: [] }),
      workflowId: '11111111-1111-4111-8111-111111111111',
      workflow: { callCount: 1, generationCount: 0, deepUpdateCount: 0 },
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

  it('requires both a key and text model before selecting BYOK', async () => {
    localStorage.setItem(
      'app-settings',
      JSON.stringify({
        provider: 'google',
        googleApiKey: 'key-without-a-model',
        memberManagedTextEnabled: true,
      })
    );
    const { analyzeContent } = await import('@/lib/llm/index');

    await expect(analyzeContent('test')).resolves.toEqual({ categories: [], keywords: [] });
    expect(generateContentMock).not.toHaveBeenCalled();
    expect(generateManagedTextMock).toHaveBeenCalledOnce();
  });

  it('does not let an incomplete OpenAI BYOK configuration recover its stored key', async () => {
    localStorage.setItem(
      'app-settings',
      JSON.stringify({
        provider: 'openai',
        openAIApiKey: 'key-without-a-model',
        memberManagedTextEnabled: true,
      })
    );
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { analyzeContent } = await import('@/lib/llm/index');

    await expect(analyzeContent('test')).resolves.toEqual({ categories: [], keywords: [] });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(generateManagedTextMock).toHaveBeenCalledOnce();
  });

  it.each([
    ['google', { googleApiKey: 'key-without-a-model' }],
    ['anthropic', { anthropicApiKey: 'key-without-a-model' }],
  ] as const)(
    'rejects incomplete %s BYOK when managed service is unavailable',
    async (provider, partial) => {
      canUseManagedTextMock.mockReturnValue(false);
      localStorage.setItem('app-settings', JSON.stringify({ provider, ...partial }));
      const fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);
      const { analyzeContent } = await import('@/lib/llm/index');

      await expect(analyzeContent('test')).rejects.toThrow('llm.api_key_missing');
      expect(fetchMock).not.toHaveBeenCalled();
      expect(generateContentMock).not.toHaveBeenCalled();
      expect(generateManagedTextMock).not.toHaveBeenCalled();
    }
  );

  it('uses managed fallback only after explicit confirmation when BYOK fails', async () => {
    localStorage.setItem(
      'app-settings',
      JSON.stringify({
        provider: 'openai',
        openAIApiKey: 'broken-key',
        openAITextModel: 'gpt-test',
        memberManagedTextEnabled: true,
      })
    );
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('byok unavailable')));
    const confirm = vi.fn().mockReturnValue(true);
    vi.stubGlobal('confirm', confirm);
    const { analyzeContent } = await import('@/lib/llm/index');

    await expect(analyzeContent('test')).resolves.toEqual({ categories: [], keywords: [] });
    expect(confirm).toHaveBeenCalledOnce();
    expect(generateManagedTextMock).toHaveBeenCalledOnce();
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
