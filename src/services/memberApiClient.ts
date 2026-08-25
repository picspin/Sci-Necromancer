import type { MGAResearchAgentId } from '@/lib/capabilities/managedResearchCapabilities';

export class MemberApiError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number
  ) {
    super(code);
    this.name = 'MemberApiError';
  }
}

const LONG_MEMBER_REQUEST_TIMEOUT_MS = 130_000;

export interface MemberStatus {
  bonusBalance: number;
  checkedInToday: boolean;
  checkinCycle: number;
  lastSeenAt: string | null;
  signupBonusClaimed: boolean;
  abstractCount: number;
  abstractQuota: 30 | 100 | 500;
  creditHistory: CreditHistoryEntry[];
}

export interface CreditHistoryEntry {
  id: string;
  delta: number;
  reason: string;
  createdAt: string;
  metadata: Record<string, unknown>;
}

export interface ManagedImageInput {
  data: string;
  mimeType: string;
}

export interface ManagedCapabilityDescriptor {
  id: string;
  kind: 'mcp' | 'agent';
  labelKey: string;
  descriptionKey: string;
  readOnly: true;
  memberOnly: true;
  bonusCost: 0 | 1;
}

interface MemberApiClientOptions {
  baseUrl: string;
  fallbackBaseUrls?: string[];
  getAccessToken: () => Promise<string | null>;
  refreshAccessToken?: () => Promise<string | null>;
  fetcher?: typeof fetch;
  requestTimeoutMs?: number;
}

export function createMemberApiClient(options: MemberApiClientOptions) {
  const baseUrls = [...new Set([options.baseUrl, ...(options.fallbackBaseUrls || [])])]
    .map((url) => url.trim().replace(/\/$/, ''))
    .filter(Boolean);
  const fetcher = options.fetcher || fetch;
  const defaultTimeoutMs = options.requestTimeoutMs ?? 15_000;

  async function request<T>(
    path: string,
    init: RequestInit = {},
    extraHeaders: Record<string, string> = {},
    timeoutMs = defaultTimeoutMs
  ): Promise<T> {
    const method = (init.method || 'GET').toUpperCase();
    const requestBaseUrls = method === 'GET' || method === 'HEAD' ? baseUrls : baseUrls.slice(0, 1);
    const performRequest = async (baseUrl: string, token: string) => {
      const controller = new AbortController();
      const abortFromCaller = () => controller.abort(init.signal?.reason);
      if (init.signal?.aborted) abortFromCaller();
      else init.signal?.addEventListener('abort', abortFromCaller, { once: true });
      const timeout = globalThis.setTimeout(() => controller.abort(), timeoutMs);
      try {
        return await fetcher(`${baseUrl}${path}`, {
          ...init,
          signal: controller.signal,
          headers: {
            Authorization: `Bearer ${token}`,
            ...(init.body ? { 'Content-Type': 'application/json' } : {}),
            ...extraHeaders,
            ...(init.headers || {}),
          },
        });
      } finally {
        globalThis.clearTimeout(timeout);
        init.signal?.removeEventListener('abort', abortFromCaller);
      }
    };

    let token = await options.getAccessToken();
    if (!token) throw new MemberApiError('unauthenticated', 401);
    let refreshed = false;
    let lastTransportError: unknown;

    for (const [index, baseUrl] of requestBaseUrls.entries()) {
      try {
        let response = await performRequest(baseUrl, token);
        if (response.status === 401 && options.refreshAccessToken && !refreshed) {
          refreshed = true;
          const refreshedToken = await options.refreshAccessToken();
          if (refreshedToken) {
            token = refreshedToken;
            response = await performRequest(baseUrl, token);
          }
        }
        if (!response.ok) {
          const payload = (await response.json().catch(() => ({}))) as { error?: string };
          if ([502, 503, 504].includes(response.status) && index < requestBaseUrls.length - 1) {
            lastTransportError = new Error(payload.error || 'member_api_unreachable');
            continue;
          }
          throw new MemberApiError(payload.error || 'member_api_error', response.status);
        }
        if (response.status === 204) return undefined as T;
        if (!response.headers.get('Content-Type')?.toLowerCase().includes('application/json')) {
          lastTransportError = new Error('member_api_invalid_response');
          continue;
        }
        try {
          return (await response.json()) as T;
        } catch (responseError) {
          lastTransportError = responseError;
        }
      } catch (requestError) {
        if (requestError instanceof MemberApiError || init.signal?.aborted) throw requestError;
        lastTransportError = requestError;
      }
    }

    const code =
      lastTransportError instanceof Error &&
      lastTransportError.message === 'member_api_invalid_response'
        ? 'member_api_invalid_response'
        : 'member_api_unreachable';
    throw new MemberApiError(code, 503);
  }

  async function listAbstracts() {
    const abstracts: Array<Record<string, unknown>> = [];
    for (let offset = 0; ; offset += 25) {
      const page = await request<{
        abstracts: Array<Record<string, unknown>>;
        hasMore: boolean;
      }>(`/api/member/abstracts?offset=${offset}`);
      abstracts.push(...page.abstracts);
      if (!page.hasMore) return { abstracts };
    }
  }

  return {
    getStatus: () => request<MemberStatus>('/api/member/status'),
    getCapabilities: () =>
      request<{ capabilities: ManagedCapabilityDescriptor[] }>('/api/member/capabilities'),
    runCapability: (input: {
      idempotencyKey: string;
      capabilityId: MGAResearchAgentId;
      enabledCapabilityIds: string[];
      prompt: string;
    }) =>
      request<{
        output: {
          type: 'text';
          text: string;
          provider?: 'mga' | 'google' | 'openai';
          model?: string;
          modelType?: 'large-language-model' | 'research-agent' | 'image-generation-model';
        };
        bonusBalance: number;
        workflowId: string;
      }>(
        '/api/member/capabilities',
        {
          method: 'POST',
          body: JSON.stringify({
            capabilityId: input.capabilityId,
            enabledCapabilityIds: input.enabledCapabilityIds,
            prompt: input.prompt,
          }),
        },
        { 'Idempotency-Key': input.idempotencyKey },
        LONG_MEMBER_REQUEST_TIMEOUT_MS
      ),
    bootstrap: () =>
      request<{ bonus_balance: number; awarded: boolean }>('/api/member/bootstrap', {
        method: 'POST',
      }),
    checkIn: () =>
      request<MemberStatus & { awarded: boolean }>('/api/member/check-in', {
        method: 'POST',
      }),
    generate: (input: {
      idempotencyKey: string;
      provider: 'gemini-3.6-flash' | 'nano-banana-pro' | 'gpt-image-2';
      model?: 'glm-5.2' | 'gpt-5.6-luna' | 'gemini-3.1-flash-image' | 'gemini-3-pro-image';
      operation:
        | 'analysis'
        | 'generation'
        | 'regeneration'
        | 'deep_update'
        | 'image_generation'
        | 'blind_review';
      workflowId?: string;
      prompt: string;
      images?: ManagedImageInput[];
      size?: '1024x1024' | '1024x1536' | '1536x1024';
    }) =>
      request<{
        output: {
          type: 'text' | 'image';
          text?: string;
          base64?: string;
          mimeType?: string;
          provider?: 'mga' | 'google' | 'openai';
          model?: string;
          requestedModel?: string;
          fallbackPath?: string[];
          modelType?: 'large-language-model' | 'research-agent' | 'image-generation-model';
        };
        bonusBalance: number;
        workflowId: string;
        workflow: {
          analysisCount: number;
          callCount: number;
          generationCount: number;
          deepUpdateCount: number;
        };
      }>(
        '/api/generate',
        {
          method: 'POST',
          body: JSON.stringify({
            provider: input.provider,
            model: input.model,
            operation: input.operation,
            workflowId: input.workflowId,
            prompt: input.prompt,
            images: input.images,
            size: input.size,
          }),
        },
        { 'Idempotency-Key': input.idempotencyKey },
        LONG_MEMBER_REQUEST_TIMEOUT_MS
      ),
    createCheckout: (bonus: number) =>
      request<{ url: string }>('/api/member/checkout', {
        method: 'POST',
        body: JSON.stringify({ bonus }),
      }),
    upgradeAbstractQuota: (targetQuota: 100 | 500) =>
      request<{ bonusBalance: number; abstractQuota: 100 | 500; charged: number }>(
        '/api/member/quota',
        {
          method: 'POST',
          body: JSON.stringify({ targetQuota }),
        }
      ),
    listAbstracts,
    saveAbstract: (body: {
      clientId: string;
      title: string;
      conference: string;
      payload: unknown;
      expectedUpdatedAt?: string | null;
    }) =>
      request<{ id: string; updated_at: string }>('/api/member/abstracts', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    deleteAbstract: (clientId: string) =>
      request<void>('/api/member/abstracts', {
        method: 'DELETE',
        body: JSON.stringify({ clientId }),
      }),
  };
}
