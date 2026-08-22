import type { AIProvider, Settings } from '@/types';
import { anthropicApiUrl } from '@/lib/llm/providerUrl';

export interface ModelCatalog {
  text: string[];
  image: string[];
}

const normalizedBase = (value: string | undefined, fallback: string) =>
  (value?.trim() || fallback).replace(/\/$/, '');

const uniqueSorted = (values: string[]) => [...new Set(values.filter(Boolean))].sort();

export async function loadProviderModels(
  provider: AIProvider,
  settings: Settings,
  fetcher: typeof fetch = fetch
): Promise<ModelCatalog> {
  if (provider === 'google') {
    if (!settings.googleApiKey?.trim()) throw new Error('model_manager.api_key_required');
    const response = await fetcher('https://generativelanguage.googleapis.com/v1beta/models', {
      headers: { 'x-goog-api-key': settings.googleApiKey.trim() },
    });
    if (!response.ok) throw new Error(`model_manager.model_load_failed:${response.status}`);
    const payload = (await response.json()) as {
      models?: Array<{ name?: string; supportedGenerationMethods?: string[] }>;
    };
    const ids = (payload.models || []).map(({ name }) => name?.replace(/^models\//, '') || '');
    return {
      text: uniqueSorted(ids.filter((id) => !/image|imagen|veo/i.test(id))),
      image: uniqueSorted(ids.filter((id) => /image|imagen/i.test(id))),
    };
  }

  if (provider === 'anthropic') {
    if (!settings.anthropicApiKey?.trim()) throw new Error('model_manager.api_key_required');
    const apiKey = settings.anthropicApiKey.trim();
    let response: Response;
    try {
      response = await fetcher(anthropicApiUrl(settings.anthropicBaseUrl, 'models'), {
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
      });
    } catch (error) {
      if (!(error instanceof TypeError)) throw error;
      response = await fetcher('/api/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          capability: 'anthropic_byok',
          resource: 'models',
          baseUrl: settings.anthropicBaseUrl || 'https://api.anthropic.com',
          apiKey,
        }),
      });
    }
    if (!response.ok) throw new Error(`model_manager.model_load_failed:${response.status}`);
    const payload = (await response.json()) as { data?: Array<{ id?: string }> };
    return { text: uniqueSorted((payload.data || []).map(({ id }) => id || '')), image: [] };
  }

  if (!settings.openAIApiKey?.trim()) throw new Error('model_manager.api_key_required');
  const response = await fetcher(
    `${normalizedBase(settings.openAIBaseUrl, 'https://api.openai.com/v1')}/models`,
    { headers: { Authorization: `Bearer ${settings.openAIApiKey.trim()}` } }
  );
  if (!response.ok) throw new Error(`model_manager.model_load_failed:${response.status}`);
  const payload = (await response.json()) as { data?: Array<{ id?: string }> };
  const ids = (payload.data || []).map(({ id }) => id || '');
  return {
    text: uniqueSorted(ids.filter((id) => !/image|dall-e/i.test(id))),
    image: uniqueSorted(ids.filter((id) => /image|dall-e/i.test(id))),
  };
}
