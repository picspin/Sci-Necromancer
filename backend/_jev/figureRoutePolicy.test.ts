import { describe, expect, it, vi } from 'vitest';
import { createFigureRoutePolicy } from './figureRoutePolicy';
import type { MemberRpcClient } from '../_member/memberService';

const reservationId = '550e8400-e29b-41d4-a716-446655440000';
const cacheKey = 'a'.repeat(64);

function policyWithReply(reply: unknown) {
  const rpc = vi.fn().mockResolvedValue(reply);
  return { policy: createFigureRoutePolicy({ rpc } as unknown as MemberRpcClient), rpc };
}

describe('Jev figure routing member policy', () => {
  it('requires a scoped reservation and accepts only typed RPC responses', async () => {
    const { policy, rpc } = policyWithReply({
      data: { status: 'reserved', reservation_id: reservationId, remaining: 29 },
      error: null,
    });
    await expect(policy.reserve('data-template', cacheKey)).resolves.toEqual({
      kind: 'reserved',
      reservationId,
      remaining: 29,
    });
    expect(rpc).toHaveBeenCalledWith(
      'jev_reserve_figure_route',
      expect.objectContaining({
        p_kind: 'data-template',
        p_cache_key: cacheKey,
      })
    );
    await expect(policy.reserve('data-template', 'not-a-hash')).rejects.toMatchObject({
      status: 400,
    });
  });

  it.each([
    null,
    {},
    { data: null, error: null },
    { data: {}, error: 'unexpected' },
    { data: { status: 'reserved', reservation_id: 'bad', remaining: 29 }, error: null },
    { data: { status: 'reserved', reservation_id: reservationId, remaining: -1 }, error: null },
  ])('fails closed on malformed RPC responses', async (reply) => {
    const { policy } = policyWithReply(reply);
    await expect(policy.reserve('illustration-category', cacheKey)).rejects.toMatchObject({
      status: 503,
    });
  });

  it('distinguishes consent and balance failures', async () => {
    const noConsent = policyWithReply({ data: null, error: { message: 'jev_consent_required' } });
    await expect(noConsent.policy.reserve('illustration-journal', cacheKey)).rejects.toMatchObject({
      status: 403,
    });
    const noBalance = policyWithReply({ data: null, error: { message: 'insufficient_bonus' } });
    await expect(noBalance.policy.reserve('illustration-journal', cacheKey)).rejects.toMatchObject({
      status: 402,
    });
  });

  it('settles a successful advisory result and rejects malformed acknowledgements', async () => {
    const { policy, rpc } = policyWithReply({ data: { status: 'settled' }, error: null });
    const result = { kind: 'illustration-category', decision: { selected: 'study-design' } };
    await expect(policy.settle(reservationId, true, result)).resolves.toBeUndefined();
    expect(rpc).toHaveBeenCalledWith(
      'jev_settle_figure_route',
      expect.objectContaining({
        p_success: true,
        p_result: result,
      })
    );
    await expect(policy.settle(reservationId, false, result)).rejects.toMatchObject({
      status: 400,
    });
    const expired = policyWithReply({ data: { status: 'expired' }, error: null });
    await expect(expired.policy.settle(reservationId, false)).rejects.toMatchObject({
      status: 409,
    });
  });
});
