import { describe, expect, it, vi } from 'vitest';
import { createJevMemberPolicy, JEV_CONSENT_VERSION } from './memberPolicy';

const key = 'a'.repeat(64);
const id = '550e8400-e29b-41d4-a716-446655440000';

describe('Jev member policy RPC boundary', () => {
  it('gets and sets versioned consent through scoped RPCs', async () => {
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({
        data: { accepted: true, version: JEV_CONSENT_VERSION },
        error: null,
      })
      .mockResolvedValueOnce({ data: {}, error: null });
    const service = createJevMemberPolicy({ rpc });
    await expect(service.getConsent()).resolves.toEqual({
      accepted: true,
      version: JEV_CONSENT_VERSION,
    });
    await service.setConsent(true);
    expect(rpc).toHaveBeenNthCalledWith(1, 'jev_get_consent');
    expect(rpc).toHaveBeenNthCalledWith(2, 'jev_set_consent', {
      p_version: JEV_CONSENT_VERSION,
      p_accepted: true,
    });
  });

  it.each([
    [
      { status: 'reserved', reservation_id: id, remaining: 29 },
      { kind: 'reserved', reservationId: id, remaining: 29 },
    ],
    [
      { status: 'cached', result: { labels: ['methods'] }, remaining: 30 },
      { kind: 'cached', result: { labels: ['methods'] }, remaining: 30 },
    ],
    [
      { status: 'pending', reservation_id: id, remaining: 29 },
      { kind: 'pending', reservationId: id, remaining: 29 },
    ],
    [
      { status: 'limited', retry_at: '2026-09-22T12:00:00Z', remaining: 0 },
      { kind: 'limited', retryAt: '2026-09-22T12:00:00Z', remaining: 0 },
    ],
  ])('normalizes reserve %o', async (row, expected) => {
    const rpc = vi.fn().mockResolvedValue({ data: row, error: null });
    await expect(createJevMemberPolicy({ rpc }).reserve(key)).resolves.toEqual(expected);
    expect(rpc).toHaveBeenCalledWith('jev_reserve_analysis', {
      p_version: JEV_CONSENT_VERSION,
      p_cache_key: key,
    });
  });

  it('rejects invalid cache keys before RPC', async () => {
    const rpc = vi.fn();
    await expect(createJevMemberPolicy({ rpc }).reserve('raw manuscript')).rejects.toMatchObject({
      code: 'invalid_jev_cache_key',
      status: 400,
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('settles a failure without a result and a success only with bounded object output', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { status: 'settled' }, error: null });
    const service = createJevMemberPolicy({ rpc });
    await service.settle(id, false);
    expect(rpc).toHaveBeenCalledWith('jev_settle_analysis', {
      p_reservation_id: id,
      p_success: false,
      p_result: null,
    });
    await service.settle(id, true, { labels: ['methods'] });
    expect(rpc).toHaveBeenLastCalledWith('jev_settle_analysis', {
      p_reservation_id: id,
      p_success: true,
      p_result: { labels: ['methods'] },
    });
    await expect(service.settle(id, true)).rejects.toMatchObject({ code: 'invalid_jev_result' });
    await expect(service.settle('not-a-uuid', false)).rejects.toMatchObject({
      code: 'invalid_jev_reservation_id',
    });
  });

  it.each([
    ['jev_consent_required', 'jev_consent_required', 403],
    ['insufficient_bonus', 'insufficient_bonus', 402],
    ['jev_reservation_not_found', 'jev_reservation_not_found', 404],
    ['jev_reservation_expired', 'jev_reservation_expired', 409],
    ['unexpected postgres detail', 'jev_policy_unavailable', 503],
  ])('maps RPC failures without leaking messages', async (message, code, status) => {
    const service = createJevMemberPolicy({
      rpc: vi.fn().mockResolvedValue({ data: null, error: { message } }),
    });
    await expect(service.reserve(key)).rejects.toMatchObject({ code, status });
  });

  it('rejects malformed or unavailable RPC results and has no provider dependency', async () => {
    const service = createJevMemberPolicy({
      rpc: vi.fn().mockResolvedValue({ data: { status: 'reserved', remaining: 1 }, error: null }),
    });
    await expect(service.reserve(key)).rejects.toMatchObject({
      code: 'jev_policy_unavailable',
      status: 503,
    });
  });
});
