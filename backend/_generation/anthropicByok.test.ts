import { afterEach, describe, expect, it, vi } from 'vitest';
import { relayAnthropicMessages, relayAnthropicRequest } from './anthropicByok';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('Anthropic BYOK relay', () => {
  it('forwards only the normalized HTTPS Messages request without persisting the key', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ content: [{ type: 'text', text: '{}' }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      relayAnthropicMessages({
        baseUrl: 'https://provider.example.com/v1/',
        apiKey: 'user-key',
        body: { model: 'claude-compatible', messages: [{ role: 'user', content: 'Test' }] },
      })
    ).resolves.toEqual({
      status: 200,
      payload: { content: [{ type: 'text', text: '{}' }] },
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://provider.example.com/v1/messages',
      expect.objectContaining({
        method: 'POST',
        redirect: 'error',
        headers: expect.objectContaining({ 'x-api-key': 'user-key' }),
      })
    );
  });

  it.each([
    'http://provider.example.com/v1',
    'https://127.0.0.1/v1',
    'https://localhost/v1',
    'https://metadata.internal/v1',
    'https://provider.example.com:8443/v1',
  ])('rejects unsafe relay target %s', async (baseUrl) => {
    vi.stubGlobal('fetch', vi.fn());
    await expect(
      relayAnthropicMessages({
        baseUrl,
        apiKey: 'user-key',
        body: { model: 'test', messages: [{ role: 'user', content: 'Test' }] },
      })
    ).rejects.toMatchObject({ code: 'invalid_anthropic_provider_url', status: 400 });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('relays model catalog reads through the same restricted provider origin', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ data: [{ id: 'claude-compatible' }] }), { status: 200 })
      );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      relayAnthropicRequest({
        resource: 'models',
        baseUrl: 'https://provider.example.com/v1',
        apiKey: 'user-key',
      })
    ).resolves.toMatchObject({ status: 200 });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://provider.example.com/v1/models',
      expect.objectContaining({ method: 'GET', redirect: 'error' })
    );
  });
});
