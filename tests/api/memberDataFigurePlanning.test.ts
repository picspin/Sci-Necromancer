import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({ getUser: vi.fn(), rpc: vi.fn(), fetch: vi.fn() }));
vi.mock('../../backend/_member/supabaseServer', async (original) => ({
  ...(await original<typeof import('../../backend/_member/supabaseServer')>()),
  createAdminSupabaseClient: () => ({ auth: { getUser: mock.getUser }, rpc: mock.rpc }),
}));
import handler from '../../api/jev';
const userId = '11111111-1111-4111-8111-111111111111';
const versionId = '22222222-2222-4222-8222-222222222222';
const token = '33333333-3333-4333-8333-333333333333';
const mapping = { category: 'col_1', value: 'col_2' };
function request(): any {
  return {
    method: 'POST',
    query: {},
    headers: {
      origin: 'https://www.rad-sci.org',
      authorization: 'Bearer synthetic-token',
      'content-type': 'application/json',
      'idempotency-key': 'figure-http-test',
    },
    body: {
      action: 'data-figure',
      operation: 'plan',
      metadataConfirmed: true,
      datasetHash: 'a'.repeat(64),
      model: 'gpt-5.6-terra',
      input: {
        templateId: 'grouped-bar',
        styleId: 'nature',
        goal: 'Compare supplied values',
        fields: [
          { id: 'col_1', alias: 'Category', type: 'categorical' },
          { id: 'col_2', alias: 'Value', type: 'continuous', unit: 'mm' },
        ],
      },
    },
  };
}
function response(): any {
  const res = { status: vi.fn(), json: vi.fn(), send: vi.fn(), setHeader: vi.fn() };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  res.send.mockReturnValue(res);
  return res;
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal('fetch', mock.fetch);
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('APP_ORIGINS', 'https://www.rad-sci.org');
  vi.stubEnv('MEMBER_DATA_FIGURES_ENABLED', 'true');
  vi.stubEnv('TYPESAFE_JEV_ENABLED', 'false');
  vi.stubEnv('MGA_BASE_URL', 'https://mga.example.test/v2');
  vi.stubEnv('MGA_API_KEY', 'synthetic-key');
  mock.getUser.mockResolvedValue({ data: { user: { id: userId } }, error: null });
  let version: any,
    cached: any,
    claimed = false,
    terminal: string | undefined;
  mock.rpc.mockImplementation(async (name: string, args: any) => {
    if (name === 'reserve_data_figure') {
      const next = {
        id: versionId,
        request_hash: args.p_request_hash,
        dataset_hash: args.p_dataset_hash,
        requested_model: args.p_requested_model,
        parent_id: args.p_parent_id,
      };
      if (version && JSON.stringify(next) !== JSON.stringify(version))
        return { data: null, error: { message: 'data_figure_idempotency_conflict' } };
      version ??= next;
      return { data: version, error: null };
    }
    if (name === 'claim_data_figure_plan') {
      const data = terminal
        ? { kind: 'terminal', status: terminal }
        : (cached ?? (claimed ? { kind: 'pending' } : { kind: 'claimed', token }));
      claimed = true;
      return { data, error: null };
    }
    if (name === 'finish_data_figure_plan') {
      cached = {
        kind: 'cached',
        mapping: args.p_mapping,
        specHash: args.p_spec_hash,
        provider: args.p_actual_provider,
        model: args.p_actual_model,
        status: 'awaiting_render',
      };
      return { data: terminal ? { kind: 'terminal', status: terminal } : cached, error: null };
    }
    if (name === 'settle_data_figure') {
      terminal ??= args.p_outcome;
      return { data: { status: terminal }, error: null };
    }
    throw new Error('unexpected RPC');
  });
  mock.fetch.mockResolvedValue(
    new Response(
      JSON.stringify({
        model: 'mga-gpt-terra-5.6',
        choices: [
          {
            message: { content: JSON.stringify({ status: 'ready', mapping }) },
            finish_reason: 'stop',
          },
        ],
      })
    )
  );
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
describe('member figure HTTP planning with synthetic upstream transport', () => {
  it('creates an owner-bound plan through the real orchestration and MGA adapter', async () => {
    const res = response();
    await handler(request(), res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'draft',
        versionId,
        requestedModel: 'gpt-5.6-terra',
        actualModel: 'mga-gpt-terra-5.6',
        spec: expect.objectContaining({ mapping }),
      })
    );
    expect(mock.rpc.mock.calls.every(([, args]) => args.p_user_id === userId)).toBe(true);
    expect(mock.fetch).toHaveBeenCalledOnce();
    expect(JSON.stringify(res.json.mock.calls)).not.toContain(token);
  });
  it('requires this request metadata to be explicitly confirmed', async () => {
    const req = request();
    req.body.metadataConfirmed = false;
    const res = response();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mock.rpc).not.toHaveBeenCalled();
    expect(mock.fetch).not.toHaveBeenCalled();
  });
  it('recovers a persisted draft without a second fetch', async () => {
    const first = response(),
      second = response();
    await handler(request(), first);
    await handler(request(), second);
    expect(second.status).toHaveBeenCalledWith(200);
    expect(second.json.mock.calls[0][0]).toMatchObject({ kind: 'draft', cached: true });
    expect(mock.fetch).toHaveBeenCalledOnce();
  });
  it('returns 202 with retry advice while a concurrent request owns planning', async () => {
    const a = response(),
      b = response();
    await Promise.all([handler(request(), a), handler(request(), b)]);
    expect([a.status.mock.calls[0][0], b.status.mock.calls[0][0]].sort()).toEqual([200, 202]);
    const pending = a.status.mock.calls[0][0] === 202 ? a : b;
    expect(pending.setHeader).toHaveBeenCalledWith('Retry-After', '2');
    expect(mock.fetch).toHaveBeenCalledOnce();
  });
  it.each([
    { userId: 'forged' },
    { actualModel: 'forged' },
    { csv: 'private' },
    { images: [] },
    { versionId },
    { idempotencyKey: 'must-be-header' },
    { metadataConfirmed: 'true' },
    { model: 'glm-5.2' },
    { input: { rawRows: [] } },
    { datasetHash: 'bad' },
    { parentId: 'bad' },
  ])('rejects invalid or extra planning payload: %o', async (extra) => {
    const req = request();
    Object.assign(req.body, extra);
    const res = response();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mock.rpc).not.toHaveBeenCalled();
    expect(mock.fetch).not.toHaveBeenCalled();
  });
  it('requires a bounded idempotency header', async () => {
    for (const value of [undefined, '', ['duplicate'], 'k'.repeat(129)]) {
      const req = request();
      req.headers['idempotency-key'] = value;
      const res = response();
      await handler(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    }
    expect(mock.rpc).not.toHaveBeenCalled();
    expect(mock.fetch).not.toHaveBeenCalled();
  });
  it('accepts valid confirmed metadata over4KiB without lifting other operation limits', async () => {
    const req = request();
    req.body.input.fields = Array.from({ length: 32 }, (_, n) => ({
      id: `col_${n + 1}`,
      alias: `Field${n}` + 'x'.repeat(100),
      type: n === 0 ? 'categorical' : 'continuous',
      ...(n === 0 ? {} : { unit: 'mm' }),
    }));
    expect(Buffer.byteLength(JSON.stringify(req.body))).toBeGreaterThan(4096);
    const res = response();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
  });
  it('rejects planning request bytes above48KiB before authentication', async () => {
    const req = request();
    req.body.input.goal = '中'.repeat(17_000);
    const res = response();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(413);
    expect(mock.getUser).not.toHaveBeenCalled();
    expect(mock.fetch).not.toHaveBeenCalled();
  });
  it('does not infer a model or retain a hold when upstream omits model metadata', async () => {
    mock.fetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify({ status: 'ready', mapping }) } }],
        })
      )
    );
    const res = response();
    await handler(request(), res);
    expect(res.status).toHaveBeenCalledWith(503);
    expect(mock.rpc).toHaveBeenCalledWith(
      'settle_data_figure',
      expect.objectContaining({ p_user_id: userId, p_id: versionId, p_outcome: 'failed' })
    );
    const retry = response();
    await handler(request(), retry);
    expect(retry.json.mock.calls[0][0]).toMatchObject({ kind: 'terminal', status: 'failed' });
    expect(mock.fetch).toHaveBeenCalledOnce();
  });
  it('releases missing-parameter plans rather than charging or marking renderable', async () => {
    const req = request();
    delete req.body.input.fields[1].unit;
    const res = response();
    await handler(req, res);
    expect(res.json.mock.calls[0][0]).toMatchObject({
      kind: 'needs_input',
      missing: ['fields.col_2.unit'],
    });
    expect(mock.rpc.mock.calls.some(([name]) => name === 'finish_data_figure_plan')).toBe(false);
    expect(mock.rpc).toHaveBeenCalledWith(
      'settle_data_figure',
      expect.objectContaining({ p_outcome: 'failed' })
    );
  });
  it('keeps the planning route closed by default and unauthenticated requests off the wallet', async () => {
    vi.stubEnv('MEMBER_DATA_FIGURES_ENABLED', 'false');
    const closed = response();
    await handler(request(), closed);
    expect(closed.status).toHaveBeenCalledWith(404);
    expect(mock.getUser).not.toHaveBeenCalled();
    vi.stubEnv('MEMBER_DATA_FIGURES_ENABLED', 'true');
    mock.getUser.mockResolvedValue({ data: { user: null }, error: { message: 'bad token' } });
    const res = response();
    await handler(request(), res);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(mock.rpc).not.toHaveBeenCalled();
    expect(mock.fetch).not.toHaveBeenCalled();
  });
  it('binds requested model and data so retries with different input cannot spend another call', async () => {
    const first = response();
    await handler(request(), first);
    const req = request();
    req.body.model = 'deepseek-v4.1-flash';
    const res = response();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(mock.fetch).toHaveBeenCalledOnce();
  });
  it('keeps hashes, identity and the claim token off the model request', async () => {
    const res = response();
    await handler(request(), res);
    const outbound = JSON.stringify(mock.fetch.mock.calls[0]);
    for (const value of [userId, versionId, token, 'a'.repeat(64), 'figure-http-test'])
      expect(outbound).not.toContain(value);
  });
});
