import { MemberServiceError, type MemberRpcClient } from '../_member/memberService.js';

export const JEV_CONSENT_VERSION = 'typesafe-member-2026-09-21-v1';

export type JevReservation =
  | { kind: 'reserved'; reservationId: string; remaining: number }
  | { kind: 'cached'; result: Record<string, unknown>; remaining: number }
  | { kind: 'pending'; reservationId: string; remaining: number }
  | { kind: 'limited'; retryAt: string; remaining: number };

type RpcResult<T> = { data: T | null; error: { message?: string } | null };
const CACHE_KEY = /^[a-f0-9]{64}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_RESULT_BYTES = 65_536;

function unavailable(): never {
  throw new MemberServiceError('jev_policy_unavailable', 503);
}
function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
function validRemaining(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 30;
}
function rpcError(error: { message?: string } | null): never {
  const message = error?.message ?? '';
  const known: Array<[string, number]> = [
    ['jev_consent_required', 403],
    ['insufficient_bonus', 402],
    ['jev_reservation_not_found', 404],
    ['jev_reservation_expired', 409],
    ['jev_reservation_conflict', 409],
    ['invalid_jev_', 400],
  ];
  for (const [code, status] of known)
    if (message.includes(code)) throw new MemberServiceError(code, status);
  return unavailable();
}
async function call<T>(
  client: MemberRpcClient,
  name: string,
  args?: Record<string, unknown>
): Promise<T> {
  let reply: RpcResult<T>;
  try {
    reply = (
      args === undefined ? await client.rpc<T>(name) : await client.rpc<T>(name, args)
    ) as RpcResult<T>;
  } catch {
    return unavailable();
  }
  if (reply.error) return rpcError(reply.error);
  if (reply.data === null) return unavailable();
  return reply.data;
}
function uuid(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value);
}
function resultObject(value: unknown): value is Record<string, unknown> {
  if (!asRecord(value)) return false;
  try {
    return new TextEncoder().encode(JSON.stringify(value)).byteLength <= MAX_RESULT_BYTES;
  } catch {
    return false;
  }
}

export function createJevMemberPolicy(client: MemberRpcClient) {
  return {
    async getConsent(): Promise<{ accepted: boolean; version: string }> {
      const row = asRecord(await call<unknown>(client, 'jev_get_consent'));
      if (!row || typeof row.accepted !== 'boolean' || typeof row.version !== 'string')
        return unavailable();
      return {
        accepted: row.accepted && row.version === JEV_CONSENT_VERSION,
        version: row.version,
      };
    },
    async setConsent(accepted: boolean): Promise<void> {
      if (typeof accepted !== 'boolean') throw new MemberServiceError('invalid_jev_consent', 400);
      await call<unknown>(client, 'jev_set_consent', {
        p_version: JEV_CONSENT_VERSION,
        p_accepted: accepted,
      });
    },
    async reserve(cacheKey: string): Promise<JevReservation> {
      if (!CACHE_KEY.test(cacheKey)) throw new MemberServiceError('invalid_jev_cache_key', 400);
      const row = asRecord(
        await call<unknown>(client, 'jev_reserve_analysis', {
          p_version: JEV_CONSENT_VERSION,
          p_cache_key: cacheKey,
        })
      );
      if (!row || typeof row.status !== 'string' || !validRemaining(row.remaining))
        return unavailable();
      if ((row.status === 'reserved' || row.status === 'pending') && uuid(row.reservation_id))
        return { kind: row.status, reservationId: row.reservation_id, remaining: row.remaining };
      if (row.status === 'cached' && resultObject(row.result))
        return { kind: 'cached', result: row.result, remaining: row.remaining };
      if (
        row.status === 'limited' &&
        typeof row.retry_at === 'string' &&
        !Number.isNaN(Date.parse(row.retry_at))
      )
        return { kind: 'limited', retryAt: row.retry_at, remaining: row.remaining };
      return unavailable();
    },
    async settle(
      reservationId: string,
      success: boolean,
      result?: Record<string, unknown>
    ): Promise<void> {
      if (!uuid(reservationId)) throw new MemberServiceError('invalid_jev_reservation_id', 400);
      if (
        typeof success !== 'boolean' ||
        (success && !resultObject(result)) ||
        (!success && result !== undefined)
      )
        throw new MemberServiceError('invalid_jev_result', 400);
      const reply = asRecord(
        await call<unknown>(client, 'jev_settle_analysis', {
          p_reservation_id: reservationId,
          p_success: success,
          p_result: success ? result : null,
        })
      );
      if (!reply || typeof reply.status !== 'string') return unavailable();
      if (reply.status === 'settled') return;
      if (reply.status === 'expired') throw new MemberServiceError('jev_reservation_expired', 409);
      if (reply.status === 'conflict')
        throw new MemberServiceError('jev_reservation_conflict', 409);
      return unavailable();
    },
  };
}
