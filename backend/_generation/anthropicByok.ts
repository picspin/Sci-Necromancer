import { isIP } from 'node:net';
import { anthropicApiUrl } from '../../lib/llm/providerUrl.js';
import { MemberServiceError } from '../_member/memberService.js';

interface AnthropicRelayInput {
  resource?: 'messages' | 'models';
  baseUrl?: string;
  apiKey?: string;
  body?: unknown;
}

const MAX_REQUEST_BYTES = 250_000;
const MAX_RESPONSE_BYTES = 1_000_000;
const BLOCKED_HOST_SUFFIXES = ['.internal', '.local', '.localhost', '.home', '.lan'];

function relayTarget(baseUrl: string, resource: 'messages' | 'models'): string {
  let target: URL;
  try {
    target = new URL(anthropicApiUrl(baseUrl, resource));
  } catch {
    throw new MemberServiceError('invalid_anthropic_provider_url', 400);
  }
  const hostname = target.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  const allowedHosts = (process.env.ANTHROPIC_BYOK_HOST_ALLOWLIST || '')
    .split(',')
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
  if (
    target.protocol !== 'https:' ||
    Boolean(target.username || target.password || target.search || target.hash) ||
    Boolean(target.port && target.port !== '443') ||
    isIP(hostname) !== 0 ||
    hostname === 'localhost' ||
    BLOCKED_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix)) ||
    (allowedHosts.length > 0 && !allowedHosts.includes(hostname))
  ) {
    throw new MemberServiceError('invalid_anthropic_provider_url', 400);
  }
  return target.toString();
}

export async function relayAnthropicRequest(input: AnthropicRelayInput): Promise<{
  status: number;
  payload: unknown;
}> {
  const resource = input.resource || 'messages';
  if (
    !['messages', 'models'].includes(resource) ||
    typeof input.baseUrl !== 'string' ||
    input.baseUrl.length > 2_048 ||
    typeof input.apiKey !== 'string' ||
    !input.apiKey.trim() ||
    input.apiKey.length > 4_096
  ) {
    throw new MemberServiceError('invalid_anthropic_relay_request', 400);
  }

  let serialized: string | undefined;
  if (resource === 'messages') {
    if (!input.body || typeof input.body !== 'object' || Array.isArray(input.body)) {
      throw new MemberServiceError('invalid_anthropic_relay_request', 400);
    }
    serialized = JSON.stringify(input.body);
    if (serialized.length > MAX_REQUEST_BYTES) {
      throw new MemberServiceError('invalid_anthropic_relay_request', 413);
    }
  }

  const upstream = await fetch(relayTarget(input.baseUrl, resource), {
    method: resource === 'messages' ? 'POST' : 'GET',
    redirect: 'error',
    signal: AbortSignal.timeout(105_000),
    headers: {
      'x-api-key': input.apiKey.trim(),
      'anthropic-version': '2023-06-01',
      ...(resource === 'messages' ? { 'content-type': 'application/json' } : {}),
    },
    body: serialized,
  });
  const contentLength = Number(upstream.headers.get('content-length') || 0);
  if (contentLength > MAX_RESPONSE_BYTES) {
    throw new MemberServiceError('anthropic_relay_response_too_large', 502);
  }
  const raw = await upstream.text();
  if (raw.length > MAX_RESPONSE_BYTES) {
    throw new MemberServiceError('anthropic_relay_response_too_large', 502);
  }
  try {
    return { status: upstream.status, payload: raw ? JSON.parse(raw) : {} };
  } catch {
    throw new MemberServiceError('anthropic_relay_invalid_response', 502);
  }
}

export function relayAnthropicMessages(input: AnthropicRelayInput) {
  return relayAnthropicRequest({ ...input, resource: 'messages' });
}
