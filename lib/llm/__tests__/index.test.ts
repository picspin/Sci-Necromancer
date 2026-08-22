import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Settings } from '@/types';
import { acceptAIDisclosure } from '@/lib/compliance/aiDisclosure';

const {
  generateContentMock,
  generateManagedTextMock,
  generateManagedResearchVerificationMock,
  canUseManagedTextMock,
  canUseManagedResearchVerificationMock,
} = vi.hoisted(() => ({
  generateContentMock: vi.fn(),
  generateManagedTextMock: vi.fn(),
  generateManagedResearchVerificationMock: vi.fn(),
  canUseManagedTextMock: vi.fn(),
  canUseManagedResearchVerificationMock: vi.fn(),
}));
vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    models = { generateContent: generateContentMock };
  },
}));
vi.mock('@/src/composables/useMembership', () => ({
  canUseManagedText: canUseManagedTextMock,
  canUseManagedResearchVerification: canUseManagedResearchVerificationMock,
  generateManagedText: generateManagedTextMock,
  generateManagedResearchVerification: generateManagedResearchVerificationMock,
}));

describe('LLM Index - Provider Selection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    localStorage.clear();
    acceptAIDisclosure();
    canUseManagedTextMock.mockReturnValue(true);
    canUseManagedResearchVerificationMock.mockReturnValue(false);
    generateContentMock.mockResolvedValue({
      text: JSON.stringify({ categories: [], keywords: [] }),
    });
    generateManagedTextMock.mockResolvedValue({
      text: JSON.stringify({ categories: [], keywords: [] }),
      workflowId: '11111111-1111-4111-8111-111111111111',
      workflow: { callCount: 1, generationCount: 0, deepUpdateCount: 0 },
    });
    generateManagedResearchVerificationMock.mockResolvedValue({
      text: JSON.stringify({
        recommendation: 'minor-revision',
        summary: 'Literature verification requires revision.',
        findings: [],
      }),
      provider: 'mga',
      model: 'glm-5',
      modelType: 'research-agent',
      workflowId: '33333333-3333-4333-8333-333333333333',
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
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('2 credits'));
    expect(generateManagedTextMock).toHaveBeenCalledOnce();
  });

  it('discloses the successful MGA model after an explicitly confirmed BYOK generation fallback', async () => {
    localStorage.setItem(
      'app-settings',
      JSON.stringify({
        provider: 'openai',
        openAIApiKey: 'broken-key',
        openAITextModel: 'failed-byok-model',
        memberManagedTextEnabled: true,
      })
    );
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('byok unavailable')));
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));
    generateManagedTextMock.mockResolvedValueOnce({
      text: JSON.stringify({
        abstract: 'Managed fallback draft',
        impact: '',
        synopsis: '',
        keywords: [],
      }),
      provider: 'mga',
      model: 'glm-5.2',
      modelType: 'large-language-model',
      workflowId: '44444444-4444-4444-8444-444444444444',
      workflow: { analysisCount: 0, callCount: 1, generationCount: 1, deepUpdateCount: 0 },
    });
    const { generateFinalAbstract } = await import('@/lib/llm/index');

    const result = await generateFinalAbstract('Source', 'Standard Abstract', [], [], '', '');

    expect(result.aiAssistance).toMatchObject({
      provider: 'mga',
      providerDisplayName: 'MGA',
      model: 'glm-5.2',
    });
  });

  it('should provide conference-specific helpers', async () => {
    const { generateAbstractForConference, generateCreativeAbstractForConference } =
      await import('@/lib/llm/index');

    expect(typeof generateAbstractForConference).toBe('function');
    expect(typeof generateCreativeAbstractForConference).toBe('function');
  });

  it('returns a journal-ready AI assistance record with every generated abstract', async () => {
    localStorage.setItem(
      'app-settings',
      JSON.stringify({ provider: 'google', googleApiKey: 'test-key', model: 'gemini-2.5-flash' })
    );
    generateContentMock.mockResolvedValueOnce({
      text: JSON.stringify({
        abstract: 'Generated abstract',
        impact: 'Clinical impact.',
        synopsis: 'Structured synopsis.',
        keywords: ['MRI'],
        aiAssistance: {
          provider: 'anthropic',
          model: 'prompt-injected-model',
          generatedAt: '1999-01-01T00:00:00.000Z',
        },
        aiAssistanceRecords: [
          {
            provider: 'openai',
            model: 'second-injected-model',
            generatedAt: '1999-01-01T00:00:00.000Z',
          },
        ],
      }),
    });
    const { generateFinalAbstract } = await import('@/lib/llm/index');

    const result = await generateFinalAbstract(
      'Source manuscript',
      'Standard Abstract',
      [],
      ['MRI'],
      'Clinical impact.',
      'Structured synopsis.'
    );

    expect(result.aiAssistance).toMatchObject({
      disclosureVersion: 'jama-2026-v1',
      platform: {
        name: 'Sci-Necromancer',
        project: 'picspin/Sci-Necromancer',
        url: 'https://www.rad-sci.org',
      },
      provider: 'google',
      model: 'gemini-2.5-flash',
      providerDisplayName: 'Google',
      modelType: 'large-language-model',
      mode: 'standard',
      authorVerificationRequired: true,
    });
    expect(result.aiAssistance?.operations).toEqual(
      expect.arrayContaining(['abstract drafting', 'language revision'])
    );
    expect(result.aiAssistance?.boundaries).toEqual(
      expect.arrayContaining(['factual claims', 'references', 'current submission requirements'])
    );
    expect(result.aiAssistanceRecords).toBeUndefined();
  });

  it('labels creative generation as content generation from an author-supplied concept', async () => {
    localStorage.setItem(
      'app-settings',
      JSON.stringify({ provider: 'google', googleApiKey: 'test-key', model: 'gemini-2.5-flash' })
    );
    generateContentMock.mockResolvedValueOnce({
      text: JSON.stringify({
        abstract: 'Creative draft',
        impact: '',
        synopsis: '',
        keywords: [],
      }),
    });
    const { generateCreativeAbstract } = await import('@/lib/llm/index');

    const result = await generateCreativeAbstract('Author-supplied core idea');

    expect(result.aiAssistance).toMatchObject({
      provider: 'google',
      model: 'gemini-2.5-flash',
      mode: 'creative',
    });
    expect(result.aiAssistance?.operations).toContain(
      'content generation from an author-supplied concept'
    );
  });

  it('keeps fenced MGA analysis and ER generation in one managed workflow', async () => {
    localStorage.setItem(
      'app-settings',
      JSON.stringify({ provider: 'google', memberManagedTextEnabled: true })
    );
    generateManagedTextMock
      .mockResolvedValueOnce({
        text: '```json\n{"categories":[{"name":"Chest","type":"main","probability":0.9}],"keywords":["CT","Lung","Screening"]}\n```',
        workflowId: '11111111-1111-4111-8111-111111111111',
        workflow: {
          analysisCount: 1,
          callCount: 1,
          generationCount: 0,
          deepUpdateCount: 0,
        },
      })
      .mockResolvedValueOnce({
        text: JSON.stringify({
          abstract: 'Generated ECR abstract',
          impact: '',
          synopsis: '',
          keywords: ['CT', 'Lung', 'Screening'],
        }),
        workflowId: '11111111-1111-4111-8111-111111111111',
        workflow: {
          analysisCount: 1,
          callCount: 2,
          generationCount: 1,
          deepUpdateCount: 0,
        },
        provider: 'mga',
        model: 'glm-5.2',
        modelType: 'large-language-model',
      });
    const { analyzeContentForConference, generateAbstractForConference } =
      await import('@/lib/llm/index');

    const analysis = await analyzeContentForConference('Source manuscript', 'ER');
    expect(analysis.categories).toHaveLength(1);
    const result = await generateAbstractForConference(
      'Source manuscript',
      'ECR Research Presentation',
      analysis.categories,
      analysis.keywords,
      'ER'
    );

    expect(generateManagedTextMock.mock.calls[1][0]).toMatchObject({
      operation: 'generation',
      workflowId: '11111111-1111-4111-8111-111111111111',
    });
    expect(result.aiAssistance).toMatchObject({
      provider: 'mga',
      model: 'glm-5.2',
      modelType: 'large-language-model',
    });
  });

  it('adds the same assistance record to conference generation through personal API', async () => {
    localStorage.setItem(
      'app-settings',
      JSON.stringify({
        provider: 'openai',
        openAIApiKey: 'test-key',
        openAITextModel: 'gpt-5.1',
        openAIBaseUrl: 'https://api.openai.com/v1',
      })
    );
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  abstract: 'Generated ECR abstract',
                  impact: '',
                  synopsis: '',
                  keywords: ['CT'],
                }),
              },
            },
          ],
        }),
      })
    );
    const { generateAbstractForConference } = await import('@/lib/llm/index');

    const result = await generateAbstractForConference(
      'Source manuscript',
      'ECR Research Presentation',
      [{ name: 'Chest', type: 'main', probability: 1 }],
      ['CT'],
      'ER'
    );

    expect(result.aiAssistance).toMatchObject({
      provider: 'openai',
      model: 'gpt-5.1',
      mode: 'standard',
    });
  });

  it('identifies a custom OpenAI-compatible endpoint without attributing it to OpenAI', async () => {
    localStorage.setItem(
      'app-settings',
      JSON.stringify({
        provider: 'openai',
        openAIApiKey: 'test-key',
        openAITextModel: 'vendor-model-v2',
        openAIBaseUrl: 'https://api.siliconflow.cn/v1',
      })
    );
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  abstract: 'Generated draft',
                  impact: '',
                  synopsis: '',
                  keywords: [],
                }),
              },
            },
          ],
        }),
      })
    );
    const { generateFinalAbstract } = await import('@/lib/llm/index');

    const result = await generateFinalAbstract('Source', 'Standard Abstract', [], [], '', '');

    expect(result.aiAssistance).toMatchObject({
      provider: 'openai',
      providerDisplayName: 'OpenAI-compatible API (api.siliconflow.cn)',
      model: 'vendor-model-v2',
    });
  });

  it('records creative conference generation through the shared disclosure contract', async () => {
    localStorage.setItem(
      'app-settings',
      JSON.stringify({ provider: 'google', googleApiKey: 'test-key', model: 'gemini-2.5-flash' })
    );
    generateContentMock.mockResolvedValueOnce({
      text: JSON.stringify({
        abstract: 'Creative oncology draft',
        impact: '',
        synopsis: '',
        keywords: [],
      }),
    });
    const { generateCreativeAbstractForConference } = await import('@/lib/llm/index');

    const result = await generateCreativeAbstractForConference('Author concept', 'ASCO');

    expect(result.aiAssistance).toMatchObject({
      provider: 'google',
      model: 'gemini-2.5-flash',
      mode: 'creative',
    });
    expect(result.aiAssistance?.operations).toContain('ASCO-aware creative drafting');
  });

  it('keeps ISMRM bundle analysis and generation in the same canonical workflow', async () => {
    localStorage.setItem(
      'app-settings',
      JSON.stringify({ provider: 'google', memberManagedTextEnabled: true })
    );
    generateManagedTextMock
      .mockResolvedValueOnce({
        text: JSON.stringify({
          categories: [{ name: 'Neuro', type: 'main', probability: 0.9 }],
          keywords: ['MRI', 'Stroke', 'Diffusion'],
          impact: 'Clinical impact.',
          synopsis: 'Structured synopsis.',
          typeSuggestions: [{ type: 'Standard Abstract', probability: 0.9 }],
        }),
        workflowId: '22222222-2222-4222-8222-222222222222',
        workflow: {
          analysisCount: 1,
          callCount: 1,
          generationCount: 0,
          deepUpdateCount: 0,
        },
      })
      .mockResolvedValueOnce({
        text: JSON.stringify({
          abstract: 'Generated ISMRM abstract',
          impact: 'Clinical impact.',
          synopsis: 'Structured synopsis.',
          keywords: ['MRI', 'Stroke', 'Diffusion'],
        }),
        workflowId: '22222222-2222-4222-8222-222222222222',
        workflow: {
          analysisCount: 1,
          callCount: 2,
          generationCount: 1,
          deepUpdateCount: 0,
        },
      });
    const { analyzeISMRMBundle, generateFinalAbstract } = await import('@/lib/llm/index');

    const analysis = await analyzeISMRMBundle('ISMRM source');
    await generateFinalAbstract(
      'ISMRM source',
      'Standard Abstract',
      analysis.categories,
      analysis.keywords,
      analysis.impact,
      analysis.synopsis,
      'generation',
      'ISMRM:ISMRM source'
    );

    expect(generateManagedTextMock.mock.calls[1][0]).toMatchObject({
      operation: 'generation',
      workflowId: '22222222-2222-4222-8222-222222222222',
    });
  });

  it('routes the existing blind-review action through the enabled managed research agent', async () => {
    canUseManagedTextMock.mockReturnValue(false);
    canUseManagedResearchVerificationMock.mockReturnValue(true);
    localStorage.setItem(
      'app-settings',
      JSON.stringify({
        memberManagedTextEnabled: true,
        capabilities: {
          skillsEnabled: true,
          mcpEnabled: true,
          bundledBlindReviewSkill: true,
          managedEnabledIds: ['mga-pubmed', 'mga-research-verification-agent'],
          imported: [],
        },
      })
    );
    const { reviewAbstractBlind } = await import('@/lib/llm/index');

    await expect(reviewAbstractBlind('Verify the abstract.')).resolves.toMatchObject({
      recommendation: 'minor-revision',
      aiAssistance: {
        provider: 'mga',
        model: 'glm-5',
        modelType: 'research-agent',
        methodsDisclosureRequired: true,
        authorVerificationRequired: true,
      },
    });
    expect(generateManagedResearchVerificationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: 'Verify the abstract.',
        enabledCapabilityIds: ['mga-pubmed'],
      })
    );
    expect(generateManagedTextMock).not.toHaveBeenCalled();
  });

  it('offers the independent research agent when blind-review BYOK fails', async () => {
    canUseManagedTextMock.mockReturnValue(false);
    canUseManagedResearchVerificationMock.mockReturnValue(true);
    localStorage.setItem(
      'app-settings',
      JSON.stringify({
        provider: 'openai',
        openAIApiKey: 'broken-key',
        openAITextModel: 'broken-model',
        capabilities: {
          skillsEnabled: true,
          mcpEnabled: true,
          bundledBlindReviewSkill: true,
          managedEnabledIds: ['mga-pubmed', 'mga-research-verification-agent'],
          imported: [],
        },
      })
    );
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('byok unavailable')));
    const confirm = vi.fn().mockReturnValue(true);
    vi.stubGlobal('confirm', confirm);
    const { reviewAbstractBlind } = await import('@/lib/llm/index');

    await expect(reviewAbstractBlind('Verify after BYOK failure.')).resolves.toMatchObject({
      recommendation: 'minor-revision',
    });
    expect(confirm).toHaveBeenCalledOnce();
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('1 credit'));
    expect(generateManagedResearchVerificationMock).toHaveBeenCalledOnce();
    expect(generateManagedTextMock).not.toHaveBeenCalled();
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
    expect(result.aiAssistance).toMatchObject({
      provider: 'google',
      model: 'gemini-2.5-flash',
      modelType: 'large-language-model',
    });
    expect(generateContentMock.mock.calls.at(-1)?.[0].contents).toContain(
      'CONTENT TYPE: education'
    );
  });
});
