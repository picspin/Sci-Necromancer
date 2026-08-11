import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('Anthropic Messages provider compatibility', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('does not duplicate /v1 when the configured base URL already includes it', async () => {
    localStorage.setItem(
      'app-settings',
      JSON.stringify({
        anthropicApiKey: 'test-key',
        anthropicBaseUrl: 'https://provider.example.com/v1/',
        anthropicTextModel: 'claude-compatible',
      })
    );
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [
          {
            type: 'text',
            text: '{"categories":[],"keywords":[]}',
          },
        ],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { analyzeContent } = await import('@/lib/llm/anthropic');
    await analyzeContent('Test');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://provider.example.com/v1/messages',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('parses fenced JSON from Anthropic-compatible providers', async () => {
    localStorage.setItem(
      'app-settings',
      JSON.stringify({ anthropicApiKey: 'test-key', anthropicTextModel: 'claude-compatible' })
    );
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          content: [
            {
              type: 'text',
              text: '```json\n{"categories":[],"keywords":["MRI"]}\n```',
            },
          ],
        }),
      })
    );

    const { analyzeContent } = await import('@/lib/llm/anthropic');
    await expect(analyzeContent('Test')).resolves.toEqual({ categories: [], keywords: ['MRI'] });
  });

  it('falls back to the same-origin relay when the browser is blocked by CORS', async () => {
    localStorage.setItem(
      'app-settings',
      JSON.stringify({
        anthropicApiKey: 'test-key',
        anthropicBaseUrl: 'https://provider.example.com/v1',
        anthropicTextModel: 'claude-compatible',
      })
    );
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: 'text', text: '{"categories":[],"keywords":["MRI"]}' }],
        }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const { analyzeContent } = await import('@/lib/llm/anthropic');
    await expect(analyzeContent('Test')).resolves.toEqual({ categories: [], keywords: ['MRI'] });

    expect(fetchMock.mock.calls[1][0]).toBe('/api/generate');
    const relayBody = JSON.parse(String((fetchMock.mock.calls[1][1] as RequestInit).body));
    expect(relayBody).toMatchObject({
      capability: 'anthropic_byok',
      baseUrl: 'https://provider.example.com/v1',
      apiKey: 'test-key',
    });
  });
});
