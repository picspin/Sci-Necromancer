import { describe, expect, it, vi } from 'vitest';
import { loadProviderModels } from './modelCatalogService';

describe('BYOK model catalog', () => {
  it('loads and separates OpenAI-compatible text and image models', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ data: [{ id: 'gpt-5' }, { id: 'gpt-image-1' }, { id: 'gpt-5' }] })
        )
      );
    await expect(
      loadProviderModels(
        'openai',
        {
          provider: 'openai',
          openAIApiKey: 'secret',
          openAIBaseUrl: 'https://example.test/v1/',
        },
        fetcher
      )
    ).resolves.toEqual({ text: ['gpt-5'], image: ['gpt-image-1'] });
    expect(fetcher).toHaveBeenCalledWith('https://example.test/v1/models', expect.anything());
  });

  it('loads Anthropic Messages models without inventing image support', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ data: [{ id: 'claude-model' }] })));
    await expect(
      loadProviderModels('anthropic', { provider: 'anthropic', anthropicApiKey: 'secret' }, fetcher)
    ).resolves.toEqual({ text: ['claude-model'], image: [] });
    expect(fetcher.mock.calls[0][1]?.headers).toMatchObject({
      'anthropic-dangerous-direct-browser-access': 'true',
    });
  });
});
