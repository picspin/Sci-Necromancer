import type { VercelRequest, VercelResponse } from '../_types/vercel.js';
import { MemberServiceError } from './memberService.js';

const configuredOrigins = () =>
  (process.env.APP_ORIGINS || 'https://www.rad-sci.org,https://rad-sci.org')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

export function prepareMemberApi(request: VercelRequest, response: VercelResponse): boolean {
  const origin = request.headers.origin;
  if (origin && configuredOrigins().includes(origin)) {
    response.setHeader('Access-Control-Allow-Origin', origin);
    response.setHeader('Vary', 'Origin');
  }
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  response.setHeader(
    'Access-Control-Allow-Headers',
    'Authorization, Content-Type, Idempotency-Key'
  );
  response.setHeader('Cache-Control', 'no-store');
  return !origin || configuredOrigins().includes(origin) || process.env.NODE_ENV !== 'production';
}

export function sendApiError(response: VercelResponse, error: unknown) {
  if (error instanceof MemberServiceError) {
    return response.status(error.status).json({ error: error.code });
  }
  console.error('Member API error:', error);
  return response.status(500).json({ error: 'internal_error' });
}

export async function verifyTurnstile(_request: VercelRequest, token: unknown): Promise<void> {
  if (typeof token !== 'string' || !token.trim() || token.length > 2048) {
    throw new MemberServiceError('turnstile_required', 400);
  }
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) throw new MemberServiceError('member_service_unavailable', 503);

  const body = new URLSearchParams({ secret, response: token });
  try {
    const result = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(10_000),
    });
    const payload = (await result.json()) as { success?: boolean };
    if (result.ok && payload.success) return;
  } catch {
    // Treat verifier timeouts and malformed responses as failed challenges.
  }
  throw new MemberServiceError('turnstile_failed', 403);
}
