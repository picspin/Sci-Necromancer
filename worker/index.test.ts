import { afterEach, describe, expect, it, vi } from 'vitest';
import worker, { type WorkerEnv } from './index';

const env = (assets = vi.fn()): WorkerEnv => ({
  ASSETS: { fetch: assets },
  API_ORIGIN: 'https://sci-necromancer-backend.vercel.app',
  SUPABASE_ORIGIN: 'https://project.supabase.co',
});

afterEach(() => vi.unstubAllGlobals());

describe('mainland-safe edge proxy', () => {
  it('proxies member APIs through the application origin', async () => {
    const upstreamFetch = vi.fn().mockResolvedValue(Response.json({ bonusBalance: 7 }));
    vi.stubGlobal('fetch', upstreamFetch);

    const response = await worker.fetch(
      new Request('https://www.rad-sci.org/api/member/status?source=account', {
        headers: { Authorization: 'Bearer member-jwt' },
      }),
      env()
    );

    const upstreamRequest = upstreamFetch.mock.calls[0][0] as Request;
    expect(upstreamRequest.url).toBe(
      'https://sci-necromancer-backend.vercel.app/api/member/status?source=account'
    );
    expect(upstreamRequest.headers.get('Authorization')).toBe('Bearer member-jwt');
    expect(response.headers.get('X-Sci-Proxy')).toBe('member-api');
    await expect(response.json()).resolves.toMatchObject({ bonusBalance: 7 });
  });

  it('proxies Supabase Auth without exposing its origin to the browser', async () => {
    const upstreamFetch = vi.fn().mockResolvedValue(Response.json({ user: { id: 'member-1' } }));
    vi.stubGlobal('fetch', upstreamFetch);

    const response = await worker.fetch(
      new Request('https://www.rad-sci.org/supabase/auth/v1/user'),
      env()
    );

    const upstreamRequest = upstreamFetch.mock.calls[0][0] as Request;
    expect(upstreamRequest.url).toBe('https://project.supabase.co/auth/v1/user');
    expect(response.headers.get('X-Sci-Proxy')).toBe('supabase');
  });

  it('passes OAuth redirects back to the browser instead of following them at the edge', async () => {
    const upstreamFetch = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: { Location: 'https://github.com/login/oauth/authorize' },
      })
    );
    vi.stubGlobal('fetch', upstreamFetch);

    const response = await worker.fetch(
      new Request('https://www.rad-sci.org/supabase/auth/v1/authorize?provider=github'),
      env()
    );

    expect(upstreamFetch.mock.calls[0][1]).toEqual({ redirect: 'manual' });
    expect(response.status).toBe(302);
    expect(response.headers.get('Location')).toBe('https://github.com/login/oauth/authorize');
  });

  it('returns a bounded JSON error when an upstream is unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('network unavailable')));

    const response = await worker.fetch(
      new Request('https://www.rad-sci.org/api/member/status'),
      env()
    );

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: 'upstream_unreachable',
      route: 'member-api',
    });
  });

  it('serves non-proxied paths from static assets', async () => {
    const assets = vi.fn().mockResolvedValue(new Response('<html></html>'));
    const request = new Request('https://www.rad-sci.org/member');

    await worker.fetch(request, env(assets));

    expect(assets).toHaveBeenCalledWith(request);
  });
});
