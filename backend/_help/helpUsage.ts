import { createHmac } from 'node:crypto';
import type { VercelRequest } from '../_types/vercel.js';
import { MemberServiceError } from '../_member/memberService.js';
import { createAdminSupabaseClient } from '../_member/supabaseServer.js';

export interface HelpUsageReservation {
  subjectHash: string;
  requestKey: string;
  allowed: boolean;
  remaining: number;
  requiresTurnstile: boolean;
  idempotent: boolean;
}

function sourceIp(request: VercelRequest): string {
  const forwarded = request.headers['x-forwarded-for'];
  const first = Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(',')[0]?.trim();
  return first || 'unknown';
}

function hashSubject(value: string): string {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!secret) throw new MemberServiceError('help_service_unavailable', 503);
  return createHmac('sha256', secret).update(value).digest('hex');
}

async function resolveSubject(request: VercelRequest) {
  const admin = createAdminSupabaseClient();
  const authorization = request.headers.authorization;
  if (!authorization?.startsWith('Bearer ')) {
    return { admin, subjectHash: hashSubject(`guest:${sourceIp(request)}`), limit: 3 };
  }
  const token = authorization.slice('Bearer '.length).trim();
  if (!token) throw new MemberServiceError('unauthenticated', 401);
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) throw new MemberServiceError('unauthenticated', 401);
  return { admin, subjectHash: hashSubject(`member:${data.user.id}`), limit: 20 };
}

export async function reserveHelpUsage(
  request: VercelRequest,
  requestKey: string,
  turnstileVerified = false
): Promise<HelpUsageReservation> {
  const { admin, subjectHash, limit } = await resolveSubject(request);
  const { data, error } = await admin.rpc('reserve_help_assistant_usage', {
    p_subject_hash: subjectHash,
    p_request_key: requestKey,
    p_daily_limit: limit,
    p_turnstile_verified: turnstileVerified,
  });
  if (error || !data || typeof data !== 'object') {
    throw new MemberServiceError('help_service_unavailable', 503);
  }
  const row = data as {
    allowed?: unknown;
    remaining?: unknown;
    requiresTurnstile?: unknown;
    idempotent?: unknown;
  };
  return {
    subjectHash,
    requestKey,
    allowed: row.allowed === true,
    remaining: typeof row.remaining === 'number' ? row.remaining : 0,
    requiresTurnstile: row.requiresTurnstile === true,
    idempotent: row.idempotent === true,
  };
}

export async function settleHelpUsage(
  reservation: HelpUsageReservation,
  succeeded: boolean
): Promise<void> {
  const admin = createAdminSupabaseClient();
  const { error } = await admin.rpc('settle_help_assistant_usage', {
    p_subject_hash: reservation.subjectHash,
    p_request_key: reservation.requestKey,
    p_succeeded: succeeded,
  });
  if (error) console.error('Failed to settle documentation assistant usage.');
}
