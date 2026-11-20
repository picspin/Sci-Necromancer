import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ getUser: vi.fn(), rpc: vi.fn() }));
vi.mock('../../backend/_member/supabaseServer', async (original) => ({
  ...(await original<typeof import('../../backend/_member/supabaseServer')>()),
  createAdminSupabaseClient: () => ({ auth: { getUser: mocks.getUser }, rpc: mocks.rpc }),
}));
import handler from '../../api/jev';

const userId = '11111111-1111-4111-8111-111111111111';
const versionId = '22222222-2222-4222-8222-222222222222';
const hash = 'a'.repeat(64);
const row = {
  id: versionId,
  user_id: userId,
  parent_id: null,
  status: 'awaiting_render',
  requested_model: 'gpt-5.6-terra',
  actual_provider: 'mga',
  actual_model: 'actual-terra',
  dataset_hash: hash,
  spec_hash: hash,
  receipt_hash: null,
  created_at: '2026-11-20T10:00:00Z',
  lease_expires_at: '2026-11-20T10:15:00Z',
  settled_at: null,
  bonus_balance: 1,
  held_bonus: 1,
  available_bonus: 0,
};
function request(operation = 'status', extra: Record<string, unknown> = {}): any {
  return {
    method: 'POST',
    query: {},
    headers: {
      origin: 'https://www.rad-sci.org',
      authorization: 'Bearer synthetic-token',
      'content-type': 'application/json',
    },
    body: { action: 'data-figure', operation, versionId, ...extra },
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
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('APP_ORIGINS', 'https://www.rad-sci.org');
  vi.stubEnv('MEMBER_DATA_FIGURES_ENABLED', 'true');
  vi.stubEnv('TYPESAFE_JEV_ENABLED', 'false');
  mocks.getUser.mockResolvedValue({ data: { user: { id: userId } }, error: null });
  mocks.rpc.mockResolvedValue({ data: { ...row }, error: null });
});
afterEach(() => vi.unstubAllEnvs());

describe('member data figure lifecycle through /api/jev', () => {
  it('reads owner status independent of the Jev analysis switch, with no-store', async () => {
    const res = response();
    await handler(request(), res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(mocks.getUser).toHaveBeenCalledWith('synthetic-token');
    expect(mocks.rpc).toHaveBeenCalledWith('get_data_figure', {
      p_id: versionId,
      p_user_id: userId,
    });
    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        version: expect.objectContaining({ id: versionId, actualModel: 'actual-terra' }),
        wallet: { bonusBalance: 1, heldBonus: 1, availableBonus: 0 },
      })
    );
  });
  it('remains disabled by default without authenticating or touching the wallet', async () => {
    vi.stubEnv('MEMBER_DATA_FIGURES_ENABLED', '');
    const res = response();
    await handler(request(), res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(mocks.getUser).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it('rejects unverified authentication without any RPC', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: { message: 'invalid token' } });
    const res = response();
    await handler(request(), res);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it('rejects browser-supplied identity rather than passing it to service-role RPCs', async () => {
    const res = response();
    await handler(request('status', { userId: 'someone-else' }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it('only forwards version-bound completion digests, not a browser model or cost', async () => {
    const res = response();
    await handler(request('complete', { specHash: hash, receiptHash: hash }), res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(mocks.rpc).toHaveBeenCalledWith('settle_data_figure', {
      p_user_id: userId,
      p_id: versionId,
      p_outcome: 'completed',
      p_spec_hash: hash,
      p_receipt_hash: hash,
    });
  });
  it.each(['cancel', 'fail'])('releases a version using the %s operation', async (operation) => {
    const status = operation === 'cancel' ? 'cancelled' : 'failed';
    mocks.rpc.mockResolvedValue({
      data: {
        ...row,
        status,
        held_bonus: 0,
        available_bonus: 1,
        settled_at: '2026-11-20T10:01:00Z',
      },
      error: null,
    });
    const res = response();
    await handler(request(operation), res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0].version.status).toBe(status);
    expect(mocks.rpc).toHaveBeenCalledWith('settle_data_figure', {
      p_id: versionId,
      p_user_id: userId,
      p_outcome: status,
      p_spec_hash: null,
      p_receipt_hash: null,
    });
  });
  it.each(['png', 'pdf', 'svg', 'reproducibility'])(
    'authorizes %s at zero extra cost without checking a positive balance',
    async (format) => {
      mocks.rpc.mockResolvedValue({
        data: {
          id: versionId,
          dataset_hash: hash,
          spec_hash: hash,
          receipt_hash: hash,
          format,
          extra_credit_cost: 0,
        },
        error: null,
      });
      const res = response();
      await handler(request('export', { format }), res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(mocks.rpc).toHaveBeenCalledWith('authorize_data_figure_export', {
        p_id: versionId,
        p_user_id: userId,
        p_format: format,
      });
      expect(res.json).toHaveBeenCalledWith({
        authorization: {
          versionId,
          datasetHash: hash,
          specHash: hash,
          receiptHash: hash,
          format,
          extraCreditCost: 0,
        },
      });
    }
  );
  it.each([
    { actualModel: 'forged' },
    { actualProvider: 'mga' },
    { model: 'gpt-5.6-terra' },
    { cost: 0 },
    { csv: 'private,row' },
    { rawRows: [] },
    { base64: 'secret-image' },
    { input: {} },
    { specHash: hash },
    { receiptHash: hash },
    { user_id: userId },
  ])('rejects unsupported status payload fields: %o', async (extra) => {
    const res = response();
    await handler(request('status', extra), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it.each(['reserve', 'plan', 'mark-renderable', 'constructor', '__proto__'])(
    'does not expose %s to clients',
    async (operation) => {
      const res = response();
      await handler(request(operation), res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(mocks.rpc).not.toHaveBeenCalled();
    }
  );
  it.each([
    { versionId: [versionId] },
    { versionId: '../other' },
    { versionId: null },
    { versionId: '' },
    { versionId: 1 },
    { operation: {} },
    { operation: null },
  ])('rejects invalid identifiers or operations: %o', async (extra) => {
    const res = response();
    await handler(request('status', extra), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it.each([
    { specHash: hash },
    { receiptHash: hash },
    { specHash: 'bad', receiptHash: hash },
    { specHash: hash, receiptHash: [hash] },
    { specHash: hash, receiptHash: hash, actualModel: 'forged' },
  ])('rejects malformed or forged completion payload: %o', async (extra) => {
    const res = response();
    await handler(request('complete', extra), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it('rejects unknown export formats before touching the wallet', async () => {
    const res = response();
    await handler(request('export', { format: 'python' }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it('rejects unapproved origin before verifying user or calling RPC', async () => {
    const req = request();
    req.headers.origin = 'https://attacker.example';
    const res = response();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(mocks.getUser).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it('requires a bearer token even when the body is valid', async () => {
    const req = request();
    delete req.headers.authorization;
    const res = response();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it('bounds the request by actual UTF-8 bytes', async () => {
    const res = response();
    await handler(request('status', { extra: '中'.repeat(1400) }), res);
    expect(res.status).toHaveBeenCalledWith(413);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it('requires JSON content type rather than accepting form-style requests', async () => {
    const req = request();
    req.headers['content-type'] = 'text/plain';
    const res = response();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(415);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it('rejects oversized declared content before parsing or authenticating', async () => {
    const req = request();
    req.headers['content-length'] = '4097';
    const res = response();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(413);
    expect(mocks.getUser).not.toHaveBeenCalled();
  });
  it.each([
    ['data_figure_not_found', 404],
    ['data_figure_export_unavailable', 404],
    ['data_figure_not_renderable', 409],
    ['data_figure_spec_conflict', 409],
    ['data_figure_receipt_conflict', 409],
    ['insufficient_bonus', 402],
    ['SQL details with a private connection string', 503],
    ['Could not find the function public.get_data_figure', 503],
  ])('maps RPC error %s to safe HTTP %s', async (message, status) => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message } });
    const res = response();
    await handler(request(), res);
    expect(res.status).toHaveBeenCalledWith(status);
    expect(res.json).toHaveBeenCalledWith({
      error: status === 503 ? 'data_figure_unavailable' : message,
    });
  });
  it('sanitizes rejected RPC promises without logging their details', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      mocks.rpc.mockRejectedValue(new Error('private database connection details'));
      const res = response();
      await handler(request('complete', { specHash: hash, receiptHash: hash }), res);
      expect(res.status).toHaveBeenCalledWith(503);
      expect(res.json).toHaveBeenCalledWith({ error: 'data_figure_unavailable' });
      expect(log).not.toHaveBeenCalled();
    } finally {
      log.mockRestore();
    }
  });
  it.each([
    null,
    [],
    { ...row, id: 'foreign-id' },
    { ...row, user_id: 'foreign-owner' },
    { ...row, status: 'invented' },
    { ...row, requested_model: 'invented' },
    { ...row, actual_model: null },
    { ...row, spec_hash: null },
    { ...row, bonus_balance: '1' },
    { ...row, available_bonus: 9 },
    { ...row, settled_at: 'bad date' },
    { ...row, created_at: 123 },
    { ...row, status: 'completed' },
  ])('fails closed on malformed or foreign version reply: %o', async (data) => {
    mocks.rpc.mockResolvedValue({ data, error: null });
    const res = response();
    await handler(request(), res);
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({ error: 'data_figure_unavailable' });
  });
  it('projects response fields without exposing owner, idempotency or arbitrary new columns', async () => {
    mocks.rpc.mockResolvedValue({
      data: {
        ...row,
        idempotency_key: 'internal-idempotency',
        private_field: 'not-public',
        request_hash: hash,
      },
      error: null,
    });
    const res = response();
    await handler(request(), res);
    const body = res.json.mock.calls[0][0];
    expect(body.version).not.toHaveProperty('user_id');
    expect(JSON.stringify(body)).not.toContain('internal-idempotency');
    expect(JSON.stringify(body)).not.toContain('not-public');
    expect(body.version).not.toHaveProperty('request_hash');
  });
  it.each([
    null,
    {},
    {
      id: versionId,
      dataset_hash: hash,
      spec_hash: hash,
      receipt_hash: hash,
      format: 'png',
      extra_credit_cost: 1,
    },
    {
      id: versionId,
      dataset_hash: hash,
      spec_hash: hash,
      receipt_hash: null,
      format: 'png',
      extra_credit_cost: 0,
    },
  ])('fails closed on unsafe export reply: %o', async (data) => {
    mocks.rpc.mockResolvedValue({ data, error: null });
    const res = response();
    await handler(request('export', { format: 'png' }), res);
    expect(res.status).toHaveBeenCalledWith(503);
  });
  it('preserves a completed zero-balance version on repeated completion replies', async () => {
    mocks.rpc.mockResolvedValue({
      data: {
        ...row,
        status: 'completed',
        receipt_hash: hash,
        settled_at: '2026-11-20T10:01:00Z',
        bonus_balance: 0,
        held_bonus: 0,
        available_bonus: 0,
      },
      error: null,
    });
    for (let n = 0; n < 2; n++) {
      const res = response();
      await handler(request('complete', { specHash: hash, receiptHash: hash }), res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json.mock.calls[0][0].wallet.availableBonus).toBe(0);
    }
  });
  it.each(['GET', 'DELETE', 'PUT'])('rejects unsupported HTTP method %s', async (method) => {
    const req = request();
    req.method = method;
    const res = response();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(405);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it('handles browser preflight without authentication', async () => {
    const req = request();
    req.method = 'OPTIONS';
    req.body = undefined;
    const res = response();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(204);
    expect(mocks.getUser).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it('keeps rejected malformed Content-Length from reaching authentication', async () => {
    const req = request();
    req.headers['content-length'] = '-1';
    const res = response();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mocks.getUser).not.toHaveBeenCalled();
  });
  it('normalizes valid UUID casing before RPC and response identity checks', async () => {
    const id = 'abcdefab-1234-4123-8123-abcdefabcdef';
    mocks.rpc.mockResolvedValue({ data: { ...row, id }, error: null });
    const res = response();
    await handler(request('status', { versionId: id.toUpperCase() }), res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(mocks.rpc).toHaveBeenCalledWith('get_data_figure', { p_id: id, p_user_id: userId });
  });
  it('rejects an export authorization returned for another version or format', async () => {
    for (const extra of [{ id: 'foreign-id' }, { format: 'svg' }]) {
      mocks.rpc.mockResolvedValue({
        data: {
          id: versionId,
          dataset_hash: hash,
          spec_hash: hash,
          receipt_hash: hash,
          format: 'png',
          extra_credit_cost: 0,
          ...extra,
        },
        error: null,
      });
      const res = response();
      await handler(request('export', { format: 'png' }), res);
      expect(res.status).toHaveBeenCalledWith(503);
    }
  });
});
