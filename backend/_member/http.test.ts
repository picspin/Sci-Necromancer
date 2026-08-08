import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemberServiceError } from './memberService';
import { verifyTurnstile } from './http';

const originalSecret = process.env.TURNSTILE_SECRET_KEY;

describe('Turnstile verification behind the edge proxy', () => {
  beforeEach(() => {
    process.env.TURNSTILE_SECRET_KEY = 'test-secret';
  });

  afterEach(() => {
    if (originalSecret === undefined) delete process.env.TURNSTILE_SECRET_KEY;
    else process.env.TURNSTILE_SECRET_KEY = originalSecret;
    vi.unstubAllGlobals();
  });

  it('does not bind a token to the proxy egress IP', async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ success: true }));
    vi.stubGlobal('fetch', fetcher);

    await verifyTurnstile(
      { headers: { 'x-forwarded-for': '203.0.113.10' } } as any,
      'verified-token'
    );

    const init = fetcher.mock.calls[0][1] as RequestInit;
    expect(String(init.body)).toContain('response=verified-token');
    expect(String(init.body)).not.toContain('remoteip');
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('rejects oversized or unavailable challenge validation', async () => {
    await expect(
      verifyTurnstile({ headers: {} } as any, 'x'.repeat(2049))
    ).rejects.toMatchObject<MemberServiceError>({ code: 'turnstile_required', status: 400 });

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('network unavailable')));
    await expect(
      verifyTurnstile({ headers: {} } as any, 'verified-token')
    ).rejects.toMatchObject<MemberServiceError>({ code: 'turnstile_failed', status: 403 });
  });
});
