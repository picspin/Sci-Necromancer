export class MemberApiError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number
  ) {
    super(code);
    this.name = 'MemberApiError';
  }
}

export interface MemberStatus {
  bonusBalance: number;
  checkedInToday: boolean;
  checkinCycle: number;
  lastSeenAt: string | null;
  signupBonusClaimed: boolean;
  abstractCount: number;
  abstractQuota: 30 | 100 | 500;
}

export interface ManagedImageInput {
  data: string;
  mimeType: string;
}

interface MemberApiClientOptions {
  baseUrl: string;
  getAccessToken: () => Promise<string | null>;
  fetcher?: typeof fetch;
}

export function createMemberApiClient(options: MemberApiClientOptions) {
  const baseUrl = options.baseUrl.replace(/\/$/, '');
  const fetcher = options.fetcher || fetch;

  async function request<T>(
    path: string,
    init: RequestInit = {},
    extraHeaders: Record<string, string> = {}
  ): Promise<T> {
    const token = await options.getAccessToken();
    if (!token) throw new MemberApiError('unauthenticated', 401);
    const response = await fetcher(`${baseUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...extraHeaders,
        ...(init.headers || {}),
      },
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      throw new MemberApiError(payload.error || 'member_api_error', response.status);
    }
    if (response.status === 204) return undefined as T;
    return response.json() as Promise<T>;
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
    bootstrap: (turnstileToken: string) =>
      request<{ bonus_balance: number; awarded: boolean }>('/api/member/bootstrap', {
        method: 'POST',
        body: JSON.stringify({ turnstileToken }),
      }),
    checkIn: (turnstileToken: string) =>
      request<MemberStatus & { awarded: boolean }>('/api/member/check-in', {
        method: 'POST',
        body: JSON.stringify({ turnstileToken }),
      }),
    generate: (input: {
      idempotencyKey: string;
      provider: 'gemini-3.6-flash' | 'nano-banana-pro' | 'gpt-image-2';
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
        output: { type: 'text' | 'image'; text?: string; base64?: string; mimeType?: string };
        bonusBalance: number;
        workflowId: string;
        workflow: { callCount: number; generationCount: number; deepUpdateCount: number };
      }>(
        '/api/generate',
        {
          method: 'POST',
          body: JSON.stringify({
            provider: input.provider,
            operation: input.operation,
            workflowId: input.workflowId,
            prompt: input.prompt,
            images: input.images,
            size: input.size,
          }),
        },
        { 'Idempotency-Key': input.idempotencyKey }
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
