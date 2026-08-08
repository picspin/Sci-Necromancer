import { describe, expect, it, vi } from 'vitest';
import { createMemberApiClient, MemberApiError } from './memberApiClient';

describe('member API client', () => {
  it('lists and runs managed research capabilities through one member endpoint', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            capabilities: [
              {
                id: 'mga-pubmed',
                kind: 'mcp',
                labelKey: 'model_manager.capability_pubmed',
                descriptionKey: 'model_manager.capability_pubmed_help',
                readOnly: true,
                memberOnly: true,
                bonusCost: 0,
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            output: { type: 'text', text: '{"recommendation":"minor-revision"}' },
            bonusBalance: 4,
            workflowId: 'task-1',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );
    const client = createMemberApiClient({
      baseUrl: 'https://api.example.test',
      getAccessToken: async () => 'member-jwt',
      fetcher,
    });

    await expect(client.getCapabilities()).resolves.toMatchObject({
      capabilities: [{ id: 'mga-pubmed', readOnly: true }],
    });
    await client.runCapability({
      idempotencyKey: 'research-1',
      capabilityId: 'mga-research-verification-agent',
      enabledCapabilityIds: ['mga-pubmed'],
      prompt: 'Verify this abstract.',
    });

    expect(fetcher.mock.calls[0][0]).toBe('https://api.example.test/api/member/capabilities');
    expect(fetcher.mock.calls[1][0]).toBe('https://api.example.test/api/member/capabilities');
    expect(fetcher.mock.calls[1][1]).toEqual(
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'Idempotency-Key': 'research-1' }),
      })
    );
  });

  it('sends managed GPT Image edit inputs with the member token and one idempotency key', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          output: { type: 'image', base64: 'image-data', mimeType: 'image/png' },
          bonusBalance: 4,
          workflowId: 'task-1',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );
    const client = createMemberApiClient({
      baseUrl: 'https://api.example.test',
      getAccessToken: async () => 'member-jwt',
      fetcher,
    });

    await expect(
      client.generate({
        idempotencyKey: 'request-1',
        provider: 'gpt-image-2',
        operation: 'image_generation',
        prompt: 'Edit this figure',
        images: [{ data: 'cmVmZXJlbmNl', mimeType: 'image/png' }],
      })
    ).resolves.toMatchObject({ bonusBalance: 4 });
    expect(fetcher).toHaveBeenCalledWith(
      'https://api.example.test/api/generate',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer member-jwt',
          'Idempotency-Key': 'request-1',
        }),
      })
    );
    const request = fetcher.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(String(request.body))).toMatchObject({
      provider: 'gpt-image-2',
      operation: 'image_generation',
      prompt: 'Edit this figure',
      images: [{ data: 'cmVmZXJlbmNl', mimeType: 'image/png' }],
    });
  });

  it('fails locally when no authenticated session exists', async () => {
    const client = createMemberApiClient({
      baseUrl: 'https://api.example.test',
      getAccessToken: async () => null,
      fetcher: vi.fn(),
    });
    await expect(client.getStatus()).rejects.toEqual(new MemberApiError('unauthenticated', 401));
  });

  it('refreshes an expired session once and retries member status without losing server state', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'unauthenticated' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            bonusBalance: 7,
            checkedInToday: true,
            checkinCycle: 2,
            lastSeenAt: '2026-07-30T00:00:00Z',
            signupBonusClaimed: true,
            abstractCount: 0,
            abstractQuota: 30,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );
    const refreshAccessToken = vi.fn().mockResolvedValue('fresh-member-jwt');
    const client = createMemberApiClient({
      baseUrl: 'https://api.example.test',
      getAccessToken: async () => 'expired-member-jwt',
      refreshAccessToken,
      fetcher,
    });

    await expect(client.getStatus()).resolves.toMatchObject({ bonusBalance: 7 });
    expect(refreshAccessToken).toHaveBeenCalledOnce();
    expect(fetcher).toHaveBeenNthCalledWith(
      2,
      'https://api.example.test/api/member/status',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer fresh-member-jwt' }),
      })
    );
  });

  it('falls back to a reachable member API when the primary route is unavailable', async () => {
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            bonusBalance: 7,
            checkedInToday: false,
            checkinCycle: 2,
            lastSeenAt: '2026-08-06T00:00:00Z',
            signupBonusClaimed: true,
            abstractCount: 0,
            abstractQuota: 30,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );
    const client = createMemberApiClient({
      baseUrl: 'https://primary-api.example.test',
      fallbackBaseUrls: ['https://same-origin.example.test'],
      getAccessToken: async () => 'member-jwt',
      fetcher,
    });

    await expect(client.getStatus()).resolves.toMatchObject({ bonusBalance: 7 });
    expect(fetcher).toHaveBeenNthCalledWith(
      2,
      'https://same-origin.example.test/api/member/status',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer member-jwt' }),
      })
    );
  });

  it('does not replay a write request against a fallback origin', async () => {
    const fetcher = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    const client = createMemberApiClient({
      baseUrl: 'https://primary-api.example.test',
      fallbackBaseUrls: ['https://fallback-api.example.test'],
      getAccessToken: async () => 'member-jwt',
      fetcher,
    });

    await expect(client.createCheckout(10)).rejects.toMatchObject({
      code: 'member_api_unreachable',
      status: 503,
    });
    expect(fetcher).toHaveBeenCalledOnce();
    expect(fetcher.mock.calls[0][0]).toBe('https://primary-api.example.test/api/member/checkout');
  });

  it('times out a blackholed primary route before trying the fallback', async () => {
    vi.useFakeTimers();
    try {
      const fetcher = vi
        .fn()
        .mockImplementationOnce((_url, init: RequestInit) => {
          return new Promise<Response>((_resolve, reject) => {
            init.signal?.addEventListener('abort', () =>
              reject(new DOMException('Aborted', 'AbortError'))
            );
          });
        })
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              bonusBalance: 7,
              checkedInToday: false,
              checkinCycle: 2,
              lastSeenAt: '2026-08-06T00:00:00Z',
              signupBonusClaimed: true,
              abstractCount: 0,
              abstractQuota: 30,
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
        );
      const client = createMemberApiClient({
        baseUrl: 'https://blackholed-api.example.test',
        fallbackBaseUrls: ['https://same-origin.example.test'],
        requestTimeoutMs: 5,
        getAccessToken: async () => 'member-jwt',
        fetcher,
      });

      const status = client.getStatus();
      await vi.advanceTimersByTimeAsync(5);

      await expect(status).resolves.toMatchObject({ bonusBalance: 7 });
      expect(fetcher).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('sends the expected cloud version for compare-and-swap updates', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 'cloud-1', updated_at: '2026-07-28T01:00:00Z' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    const client = createMemberApiClient({
      baseUrl: 'https://api.example.test',
      getAccessToken: async () => 'member-jwt',
      fetcher,
    });

    await client.saveAbstract({
      clientId: 'local-1',
      title: 'Draft',
      conference: 'RSNA',
      payload: { abstractData: { abstract: 'text' } },
      expectedUpdatedAt: '2026-07-28T00:00:00Z',
    });

    const body = JSON.parse(String(fetcher.mock.calls[0][1]?.body));
    expect(body.expectedUpdatedAt).toBe('2026-07-28T00:00:00Z');
  });
});
