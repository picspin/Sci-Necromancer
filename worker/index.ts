interface FetcherBinding {
  fetch(request: Request): Promise<Response>;
}

export interface WorkerEnv {
  ASSETS: FetcherBinding;
  API_ORIGIN: string;
  SUPABASE_ORIGIN: string;
}

type ProxyRoute = {
  prefix: '/api' | '/supabase';
  origin: string;
  label: 'member-api' | 'supabase';
};

function normalizedOrigin(value: string): string {
  return value.trim().replace(/\/$/, '');
}

function upstreamUrl(requestUrl: URL, route: ProxyRoute): URL {
  const target = new URL(normalizedOrigin(route.origin));
  target.pathname =
    route.prefix === '/supabase'
      ? requestUrl.pathname.slice(route.prefix.length) || '/'
      : requestUrl.pathname;
  target.search = requestUrl.search;
  return target;
}

async function proxyRequest(request: Request, route: ProxyRoute): Promise<Response> {
  try {
    const upstreamRequest = new Request(upstreamUrl(new URL(request.url), route), request);
    const upstreamResponse = await fetch(upstreamRequest, { redirect: 'manual' });
    const headers = new Headers(upstreamResponse.headers);
    headers.set('Cache-Control', 'no-store');
    headers.set('X-Sci-Proxy', route.label);
    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers,
    });
  } catch (error) {
    console.error(`[edge-proxy] ${route.label} upstream unavailable`, error);
    return Response.json(
      { error: 'upstream_unreachable', route: route.label },
      {
        status: 502,
        headers: {
          'Cache-Control': 'no-store',
          'X-Sci-Proxy': route.label,
        },
      }
    );
  }
}

export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const pathname = new URL(request.url).pathname;
    if (pathname === '/api' || pathname.startsWith('/api/')) {
      return proxyRequest(request, {
        prefix: '/api',
        origin: env.API_ORIGIN,
        label: 'member-api',
      });
    }
    if (pathname === '/supabase' || pathname.startsWith('/supabase/')) {
      return proxyRequest(request, {
        prefix: '/supabase',
        origin: env.SUPABASE_ORIGIN,
        label: 'supabase',
      });
    }
    return env.ASSETS.fetch(request);
  },
};
