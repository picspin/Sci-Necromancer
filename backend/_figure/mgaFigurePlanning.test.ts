import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { requestMGADataFigurePlan } from './mgaFigurePlanning';

const body = { system: 'Return strict column mappings only', user: '{"fields":[]}' };
const fetcher = vi.fn();
beforeEach(() => {
  vi.stubEnv('MGA_BASE_URL', 'https://mga.example.test/v3');
  vi.stubEnv('MGA_API_KEY', 'synthetic-test-key');
  vi.stubGlobal('fetch', fetcher);
  fetcher.mockReset();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
const reply = (extra: Record<string, unknown> = {}) =>
  new Response(
    JSON.stringify({
      model: 'reported-model',
      choices: [
        {
          message: { content: '{"status":"ready","mapping":{"value":"col_1"}}' },
          finish_reason: 'stop',
        },
      ],
      ...extra,
    }),
    { headers: { 'content-type': 'application/json' } }
  );

describe('MGA figure planner transport (synthetic fetch only)', () => {
  it.each([
    ['gpt-5.6-terra', 'mga-gpt-terra-5.6'],
    ['deepseek-v4.1-flash', 'deepseek-v4.1-flash'],
  ] as const)(
    'maps %s to one v2 request for %s and keeps the reported model',
    async (model, routed) => {
      fetcher.mockResolvedValue(reply());
      const result = await requestMGADataFigurePlan(body, model);
      expect(result).toMatchObject({ provider: 'mga', model: 'reported-model' });
      expect(fetcher).toHaveBeenCalledOnce();
      const [url, options] = fetcher.mock.calls[0];
      expect(url).toBe('https://mga.example.test/v2/chat/completions');
      expect(options.redirect).toBe('error');
      expect(options.signal).toBeInstanceOf(AbortSignal);
      expect(JSON.parse(options.body)).toMatchObject({
        model: routed,
        stream: false,
        messages: [
          { role: 'system', content: body.system },
          { role: 'user', content: body.user },
        ],
        response_format: { type: 'json_object' },
      });
    }
  );
  it('does not invent an actual model if the upstream omits it', async () => {
    fetcher.mockResolvedValue(reply({ model: undefined }));
    await expect(requestMGADataFigurePlan(body, 'gpt-5.6-terra')).rejects.toMatchObject({
      code: 'data_figure_provider_unavailable',
    });
    expect(fetcher).toHaveBeenCalledOnce();
  });
  it.each([429, 500, 502])('does not retry or fall back after HTTP %s', async (status) => {
    fetcher.mockResolvedValue(new Response('private error with keys', { status }));
    await expect(requestMGADataFigurePlan(body, 'gpt-5.6-terra')).rejects.toMatchObject({
      code: 'data_figure_provider_unavailable',
    });
    expect(fetcher).toHaveBeenCalledOnce();
  });
  it.each([undefined, null, '', ' ', 'x'.repeat(129), {}])(
    'rejects invalid reported model %o',
    async (model) => {
      fetcher.mockResolvedValue(reply({ model }));
      await expect(requestMGADataFigurePlan(body, 'gpt-5.6-terra')).rejects.toMatchObject({
        code: 'data_figure_provider_unavailable',
      });
    }
  );
  it.each([
    { choices: [] },
    { choices: [{ message: { content: '' } }] },
    { choices: [{ message: { content: '{}' }, finish_reason: 'length' }] },
    { choices: [{ message: { content: '{}', refusal: 'blocked' } }] },
    { choices: [{ message: { content: '{}', tool_calls: [{ id: 'unexpected' }] } }] },
    { choices: [{ message: { content: [{ text: '{}' }] } }] },
  ])('rejects empty, truncated, refused or unexpected response shape: %o', async (extra) => {
    fetcher.mockResolvedValue(reply(extra));
    await expect(requestMGADataFigurePlan(body, 'gpt-5.6-terra')).rejects.toMatchObject({
      status: 503,
    });
    expect(fetcher).toHaveBeenCalledOnce();
  });
  it('bounds actual streamed response bytes even without Content-Length', async () => {
    fetcher.mockResolvedValue(new Response('x'.repeat(65_537)));
    await expect(requestMGADataFigurePlan(body, 'gpt-5.6-terra')).rejects.toMatchObject({
      status: 503,
    });
    expect(fetcher).toHaveBeenCalledOnce();
  });
  it('rejects an oversized declared response without consuming its body', async () => {
    fetcher.mockResolvedValue(new Response('{}', { headers: { 'content-length': '65537' } }));
    await expect(requestMGADataFigurePlan(body, 'gpt-5.6-terra')).rejects.toMatchObject({
      status: 503,
    });
  });
  it.each(['not-json', '{"model":'])('sanitizes malformed JSON %s', async (data) => {
    fetcher.mockResolvedValue(new Response(data));
    await expect(requestMGADataFigurePlan(body, 'gpt-5.6-terra')).rejects.toMatchObject({
      code: 'data_figure_provider_unavailable',
    });
  });
  it('does not retry timeouts or expose the transport error', async () => {
    fetcher.mockRejectedValue(new Error('private network details and synthetic-test-key'));
    await expect(requestMGADataFigurePlan(body, 'gpt-5.6-terra')).rejects.toMatchObject({
      message: 'data_figure_provider_unavailable',
    });
    expect(fetcher).toHaveBeenCalledOnce();
  });
  it.each([
    '',
    'http://mga.example.test/v2',
    'https://mga.example.test/no-version',
    'https://user:pass@mga.example.test/v2',
  ])('rejects absent or unsafe base URL %s before fetch', async (value) => {
    vi.stubEnv('MGA_BASE_URL', value);
    await expect(requestMGADataFigurePlan(body, 'gpt-5.6-terra')).rejects.toMatchObject({
      status: 503,
    });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('rejects missing credentials without trying another provider', async () => {
    vi.stubEnv('MGA_API_KEY', '');
    await expect(requestMGADataFigurePlan(body, 'gpt-5.6-terra')).rejects.toMatchObject({
      status: 503,
    });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('rejects invalid request/model before network access', async () => {
    await expect(requestMGADataFigurePlan(body, 'glm-5.2' as any)).rejects.toMatchObject({
      status: 400,
    });
    await expect(
      requestMGADataFigurePlan({ ...body, user: '中'.repeat(14_000) }, 'gpt-5.6-terra')
    ).rejects.toMatchObject({ status: 400 });
    expect(fetcher).not.toHaveBeenCalled();
  });
});
