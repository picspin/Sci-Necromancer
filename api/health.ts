import { timingSafeEqual } from 'node:crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';

function configured(name: string): boolean {
  return Boolean(process.env[name]?.trim());
}

function trustedProbe(request: VercelRequest): boolean {
  const expected = process.env.HEALTHCHECK_TOKEN;
  const supplied = request.headers['x-health-token'];
  if (!expected || typeof supplied !== 'string') return false;
  const left = Buffer.from(expected);
  const right = Buffer.from(supplied);
  return left.length === right.length && timingSafeEqual(left, right);
}

async function probeProviders() {
  const result: Record<string, boolean> = {};
  if (configured('GEMINI_API_KEY')) {
    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash',
      { headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY! } }
    ).catch(() => null);
    result.gemini = Boolean(response?.ok);
  }
  if (configured('OPENAI_API_KEY')) {
    const response = await fetch('https://api.openai.com/v1/models/gpt-image-2', {
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    }).catch(() => null);
    result.openai = Boolean(response?.ok);
  }
  return result;
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
  response.setHeader('Cache-Control', 'no-store');
  const region = process.env.VERCEL_REGION || 'local';
  const services = {
    membership: configured('SUPABASE_URL') && configured('SUPABASE_SERVICE_ROLE_KEY'),
    gemini: configured('GEMINI_API_KEY'),
    openai: configured('OPENAI_API_KEY'),
    stripe:
      configured('STRIPE_SECRET_KEY') &&
      configured('STRIPE_WEBHOOK_SECRET') &&
      configured('APP_PUBLIC_URL'),
  };
  const payload: Record<string, unknown> = {
    status: region === 'local' || region === 'iad1' ? 'ok' : 'degraded',
    region,
    expectedRegion: 'iad1',
    services,
  };
  if (request.query.probe === 'providers') {
    if (!trustedProbe(request)) return response.status(403).json({ error: 'probe_forbidden' });
    payload.reachability = await probeProviders();
  }
  return response.status(200).json(payload);
}
