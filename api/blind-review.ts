import type { VercelRequest, VercelResponse } from '../backend/_types/vercel.js';
import { timingSafeEqual } from 'node:crypto';
import type { BlindReviewSettings } from '../types.js';
import { runExternalReviewers } from '../backend/_review/externalReview.js';

const MAX_TEXT_LENGTH = 50_000;
const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT = 10;
const requestWindows = new Map<string, { startedAt: number; count: number }>();

function rateLimited(request: VercelRequest): boolean {
  const forwarded = request.headers['x-forwarded-for'];
  const key = (Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(',')[0]) || 'unknown';
  const now = Date.now();
  const window = requestWindows.get(key);
  if (!window || now - window.startedAt >= RATE_WINDOW_MS) {
    requestWindows.set(key, { startedAt: now, count: 1 });
    return false;
  }
  window.count += 1;
  return window.count > RATE_LIMIT;
}

function hasAllowedOrigin(request: VercelRequest): boolean {
  const origin = request.headers.origin;
  const host = request.headers.host;
  if (!origin || !host) return process.env.NODE_ENV !== 'production';
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

function hasTrustedMCPGateway(request: VercelRequest): boolean {
  const expected = process.env.BLIND_REVIEW_EDGE_TOKEN;
  const supplied = request.headers['x-blind-review-edge-token'];
  if (!expected || typeof supplied !== 'string') return false;
  const expectedBuffer = Buffer.from(expected);
  const suppliedBuffer = Buffer.from(supplied);
  return (
    expectedBuffer.length === suppliedBuffer.length &&
    timingSafeEqual(expectedBuffer, suppliedBuffer)
  );
}

function isReviewerSelection(value: unknown): value is BlindReviewSettings['reviewers'] {
  if (!value || typeof value !== 'object') return false;
  const reviewers = value as Record<string, unknown>;
  return (
    typeof reviewers.pubmed === 'boolean' &&
    typeof reviewers.citecheck === 'boolean' &&
    typeof reviewers['doi-mcp'] === 'boolean'
  );
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
  response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  response.setHeader('Cache-Control', 'no-store');

  if (request.method === 'OPTIONS') return response.status(204).send('');
  if (request.method !== 'POST') return response.status(405).json({ error: 'method_not_allowed' });
  if (!hasAllowedOrigin(request)) return response.status(403).json({ error: 'origin_not_allowed' });
  if (rateLimited(request)) return response.status(429).json({ error: 'rate_limited' });
  if (
    !String(request.headers['content-type'] || '')
      .toLowerCase()
      .startsWith('application/json')
  ) {
    return response.status(415).json({ error: 'json_required' });
  }

  const body = request.body as Record<string, unknown> | undefined;
  const generatedText = typeof body?.generatedText === 'string' ? body.generatedText.trim() : '';
  const title = typeof body?.title === 'string' ? body.title.slice(0, 500) : undefined;
  const keywords = Array.isArray(body?.keywords)
    ? body.keywords
        .filter((item): item is string => typeof item === 'string')
        .slice(0, 20)
        .map((item) => item.slice(0, 200))
    : [];

  if (!generatedText || generatedText.length > MAX_TEXT_LENGTH) {
    return response.status(400).json({ error: 'invalid_generated_text' });
  }
  if (!isReviewerSelection(body?.reviewers)) {
    return response.status(400).json({ error: 'invalid_reviewer_selection' });
  }
  if ((body.reviewers.citecheck || body.reviewers['doi-mcp']) && !hasTrustedMCPGateway(request)) {
    return response.status(403).json({ error: 'privileged_reviewers_require_trusted_gateway' });
  }

  const results = await runExternalReviewers({
    generatedText,
    title,
    keywords,
    reviewers: body.reviewers,
  });
  return response.status(200).json({ results });
}
