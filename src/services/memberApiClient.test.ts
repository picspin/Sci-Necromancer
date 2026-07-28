import { describe, expect, it, vi } from 'vitest';
import { createMemberApiClient, MemberApiError } from './memberApiClient';

describe('member API client', () => {
  it('sends the Supabase access token and idempotency key for managed generation', async () => {
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
        prompt: 'Create a figure',
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
  });

  it('fails locally when no authenticated session exists', async () => {
    const client = createMemberApiClient({
      baseUrl: 'https://api.example.test',
      getAccessToken: async () => null,
      fetcher: vi.fn(),
    });
    await expect(client.getStatus()).rejects.toEqual(new MemberApiError('unauthenticated', 401));
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
