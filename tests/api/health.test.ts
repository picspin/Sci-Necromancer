import type { VercelRequest, VercelResponse } from '@vercel/node';
import { afterEach, describe, expect, it, vi } from 'vitest';
import handler from '../../api/health';

function responseHarness() {
  let statusCode = 200;
  let payload: unknown;
  const response = {
    setHeader: vi.fn(),
    status: vi.fn((code: number) => {
      statusCode = code;
      return response;
    }),
    json: vi.fn((body: unknown) => {
      payload = body;
      return response;
    }),
  } as unknown as VercelResponse;
  return { response, result: () => ({ statusCode, payload }) };
}

describe('GET /api/health?probe=providers', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('checks provider credentials through read-only model catalogs without generating content', async () => {
    vi.stubEnv('HEALTHCHECK_TOKEN', 'health-secret');
    vi.stubEnv('MGA_BASE_URL', 'https://mga.example.com/api/v2');
    vi.stubEnv('MGA_API_KEY', 'mga-secret');
    vi.stubEnv('GOOGLE_API_KEY', 'google-secret');
    vi.stubEnv('GEMINI_API_KEY', '');
    vi.stubEnv('OPENAI_API_KEY', 'openai-secret');
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ object: 'list', data: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    vi.stubGlobal('fetch', fetchMock);
    const request = {
      method: 'GET',
      query: { probe: 'providers' },
      headers: { 'x-health-token': 'health-secret' },
    } as unknown as VercelRequest;
    const harness = responseHarness();

    await handler(request, harness.response);

    expect(harness.result()).toMatchObject({
      statusCode: 200,
      payload: { reachability: { mga: true, gemini: true, openai: true } },
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://mga.example.com/api/v2/models',
      expect.objectContaining({ headers: { Authorization: 'Bearer mga-secret' } })
    );
    expect(fetchMock).toHaveBeenCalledWith(
      'https://generativelanguage.googleapis.com/v1beta/models?pageSize=1',
      expect.objectContaining({ headers: { 'x-goog-api-key': 'google-secret' } })
    );
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.openai.com/v1/models',
      expect.objectContaining({ headers: { Authorization: 'Bearer openai-secret' } })
    );
  });
});
