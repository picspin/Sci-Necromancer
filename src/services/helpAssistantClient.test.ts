import { describe, expect, it, vi } from 'vitest';
import { createHelpAssistantClient } from './helpAssistantClient';

describe('help assistant client', () => {
  it('sends minimal page context and optional member authentication to the public help endpoint', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          mode: 'assisted',
          text: 'Check the configured provider protocol.',
          citations: [{ articleId: 'troubleshooting', title: 'Common troubleshooting' }],
          shortcuts: ['open-model-settings'],
          remaining: 19,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );
    const client = createHelpAssistantClient({
      baseUrl: 'https://api.example.test',
      getAccessToken: async () => 'member-token',
      fetcher,
    });

    await client.ask({
      question: 'Why is the API slow?',
      locale: 'en',
      context: { authenticated: true, provider: 'anthropic', textApiConfigured: true },
    });

    expect(fetcher).toHaveBeenCalledWith(
      'https://api.example.test/api/help',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer member-token' }),
      })
    );
    const body = JSON.parse(String(fetcher.mock.calls[0][1]?.body));
    expect(body).toMatchObject({
      capability: 'documentation_assistant',
      question: 'Why is the API slow?',
      locale: 'en',
      context: { authenticated: true, provider: 'anthropic', textApiConfigured: true },
    });
  });

  it('limits the request to six prior conversation turns', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ mode: 'fallback', text: 'See troubleshooting.', requestId: 'help-1' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );
    const client = createHelpAssistantClient({ baseUrl: 'https://api.example.test', fetcher });
    const history = Array.from({ length: 14 }, (_, index) => ({
      role: index % 2 === 0 ? ('user' as const) : ('assistant' as const),
      content: `message-${index}`,
    }));

    await client.ask({
      question: 'API error 429',
      locale: 'en',
      context: { authenticated: false },
      history,
    });

    const body = JSON.parse(String(fetcher.mock.calls[0][1]?.body));
    expect(body.history).toEqual(history.slice(-12));
  });
});
