import type { HelpPageContext } from '@/lib/help/helpCatalog';

export interface HelpAssistantResponse {
  mode: 'shortcut' | 'assisted' | 'fallback';
  text: string;
  citations: Array<{ articleId: string; title: string; lastVerified?: string }>;
  shortcuts: string[];
  remaining?: number;
  requestId?: string;
}

export class HelpAssistantError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    public readonly remaining?: number
  ) {
    super(code);
    this.name = 'HelpAssistantError';
  }
}

interface HelpAssistantClientOptions {
  baseUrl: string;
  getAccessToken?: () => Promise<string | null>;
  fetcher?: typeof fetch;
}

export function createHelpAssistantClient(options: HelpAssistantClientOptions) {
  const baseUrl = options.baseUrl.replace(/\/$/, '');
  const fetcher = options.fetcher || fetch;

  return {
    async ask(input: {
      question: string;
      locale: 'en' | 'zh';
      context: HelpPageContext;
      history?: Array<{ role: 'user' | 'assistant'; content: string }>;
      turnstileToken?: string;
      signal?: AbortSignal;
      idempotencyKey?: string;
    }): Promise<HelpAssistantResponse> {
      const token = await options.getAccessToken?.();
      const response = await fetcher(`${baseUrl}/api/help`, {
        method: 'POST',
        signal: input.signal,
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key':
            input.idempotencyKey ||
            globalThis.crypto?.randomUUID?.() ||
            `help-${Date.now()}-${Math.random()}`,
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          capability: 'documentation_assistant',
          question: input.question,
          locale: input.locale,
          context: input.context,
          history: (input.history || []).slice(-12),
          ...(input.turnstileToken ? { turnstileToken: input.turnstileToken } : {}),
        }),
      });
      const payload = (await response
        .json()
        .catch(() => ({}))) as Partial<HelpAssistantResponse> & {
        error?: string;
      };
      if (!response.ok) {
        throw new HelpAssistantError(
          payload.error || 'help_service_unavailable',
          response.status,
          payload.remaining
        );
      }
      if (!payload.mode || typeof payload.text !== 'string') {
        throw new HelpAssistantError('help_invalid_response', 502);
      }
      return {
        mode: payload.mode,
        text: payload.text,
        citations: Array.isArray(payload.citations) ? payload.citations : [],
        shortcuts: Array.isArray(payload.shortcuts) ? payload.shortcuts : [],
        remaining: payload.remaining,
        requestId: typeof payload.requestId === 'string' ? payload.requestId : undefined,
      };
    },
  };
}
