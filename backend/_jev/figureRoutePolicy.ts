import { MemberServiceError, type MemberRpcClient } from '../_member/memberService.js';
import { JEV_CONSENT_VERSION } from './memberPolicy.js';

export type FigureRouteKind =
  | 'data-template'
  | 'illustration-category'
  | 'illustration-journal'
  | 'illustration-prompt'
  | 'illustration-retry';
export type FigureRouteReservation =
  | { kind: 'reserved'; reservationId: string; remaining: number }
  | { kind: 'cached'; result: unknown; remaining: number }
  | { kind: 'pending'; remaining: number }
  | { kind: 'limited'; remaining: number };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CACHE_KEY = /^[a-f0-9]{64}$/;

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

async function rpc(client: MemberRpcClient, name: string, args: Record<string, unknown>) {
  let reply: unknown;
  try {
    reply = await client.rpc(name, args);
  } catch {
    throw new MemberServiceError('jev_figure_policy_unavailable', 503);
  }
  const envelope = record(reply);
  if (
    !envelope ||
    !('error' in envelope) ||
    !('data' in envelope) ||
    (envelope.error !== null && !record(envelope.error))
  ) {
    throw new MemberServiceError('jev_figure_policy_unavailable', 503);
  }
  const rpcError = record(envelope.error);
  if (rpcError) {
    const message = typeof rpcError.message === 'string' ? rpcError.message : '';
    if (message.includes('jev_consent_required'))
      throw new MemberServiceError('jev_consent_required', 403);
    if (message.includes('insufficient_bonus'))
      throw new MemberServiceError('insufficient_bonus', 402);
    throw new MemberServiceError('jev_figure_policy_unavailable', 503);
  }
  const row = record(envelope.data);
  if (!row) throw new MemberServiceError('jev_figure_policy_unavailable', 503);
  return row;
}

export function createFigureRoutePolicy(client: MemberRpcClient) {
  return {
    async reserve(kind: FigureRouteKind, cacheKey: string): Promise<FigureRouteReservation> {
      if (!CACHE_KEY.test(cacheKey)) throw new MemberServiceError('invalid_jev_figure_route', 400);
      const row = await rpc(client, 'jev_reserve_figure_route', {
        p_version: JEV_CONSENT_VERSION,
        p_kind: kind,
        p_cache_key: cacheKey,
      });
      const remaining = row.remaining;
      if (!Number.isInteger(remaining) || (remaining as number) < 0 || (remaining as number) > 30)
        throw new MemberServiceError('jev_figure_policy_unavailable', 503);
      if (
        row.status === 'reserved' &&
        typeof row.reservation_id === 'string' &&
        UUID.test(row.reservation_id)
      )
        return {
          kind: 'reserved',
          reservationId: row.reservation_id,
          remaining: remaining as number,
        };
      if (row.status === 'cached' && record(row.result))
        return { kind: 'cached', result: row.result, remaining: remaining as number };
      if (row.status === 'pending' || row.status === 'limited')
        return { kind: row.status, remaining: remaining as number };
      throw new MemberServiceError('jev_figure_policy_unavailable', 503);
    },
    async settle(
      reservationId: string,
      success: boolean,
      result?: Record<string, unknown>
    ): Promise<void> {
      if (
        !UUID.test(reservationId) ||
        (success && !record(result)) ||
        (!success && result !== undefined)
      )
        throw new MemberServiceError('invalid_jev_figure_result', 400);
      const row = await rpc(client, 'jev_settle_figure_route', {
        p_reservation_id: reservationId,
        p_success: success,
        p_result: success ? result : null,
      });
      if (row.status === 'settled') return;
      if (row.status === 'expired') throw new MemberServiceError('jev_reservation_expired', 409);
      if (row.status === 'conflict') throw new MemberServiceError('jev_reservation_conflict', 409);
      throw new MemberServiceError('jev_figure_policy_unavailable', 503);
    },
  };
}
