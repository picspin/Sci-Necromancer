import { MemberServiceError } from '../_member/memberService.js';
import { resolveResearchToolKeys } from '../_capabilities/capabilityRegistry.js';
import type { ManagedGenerationOutput, ManagedProvider } from './managedGeneration.js';

export interface ProviderImageInput {
  data: string;
  mimeType: string;
}

export interface ProviderRequest {
  provider: ManagedProvider;
  prompt: string;
  images?: ProviderImageInput[];
  size?: '1024x1024' | '1024x1536' | '1536x1024';
  reasoning?: 'default' | 'high';
}

const PROVIDER_TIMEOUT_MS = 105_000;
const providerTimeout = (timeoutMs = PROVIDER_TIMEOUT_MS) => AbortSignal.timeout(timeoutMs);

const PROVIDER_RESPONSE_LIMIT = 6_000_000;

function providerSecret(name: 'GEMINI_API_KEY' | 'OPENAI_API_KEY'): string {
  const value = process.env[name]?.trim();
  if (!value) throw new MemberServiceError('managed_provider_unavailable', 503);
  return value;
}

function providerModel(
  name:
    | 'GEMINI_TEXT_MODEL'
    | 'OPENAI_IMAGE_MODEL'
    | 'MGA_TEXT_MODEL'
    | 'MGA_RESEARCH_AGENT_MODEL'
    | 'MGA_IMAGE_AGENT_MODEL'
    | 'MGA_IMAGEN_MODEL'
    | 'MGA_GPT_IMAGE_MODEL',
  fallback: string
): string {
  return process.env[name]?.trim() || fallback;
}

export function getMGAConfig(): { baseUrl: string; apiKey: string } | null {
  const rawBaseUrl = process.env.MGA_BASE_URL?.trim();
  const apiKey = process.env.MGA_API_KEY?.trim();
  if (!rawBaseUrl && !apiKey) return null;
  if (!rawBaseUrl || !apiKey) throw new MemberServiceError('managed_provider_unavailable', 503);

  let url: URL;
  try {
    url = new URL(rawBaseUrl);
  } catch {
    throw new MemberServiceError('managed_provider_unavailable', 503);
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
    throw new MemberServiceError('managed_provider_unavailable', 503);
  }
  const basePath = url.pathname.replace(/\/$/, '');
  if (!/\/v[23]$/.test(basePath)) {
    throw new MemberServiceError('managed_provider_unavailable', 503);
  }
  const versionlessPath = basePath.replace(/\/v[23]$/, '');
  return {
    baseUrl: `${url.origin}${versionlessPath}/v2`,
    apiKey,
  };
}

async function jsonOrProviderError(response: Response): Promise<any> {
  const contentLength = Number(response.headers.get('content-length') || 0);
  if (contentLength > PROVIDER_RESPONSE_LIMIT) {
    throw new MemberServiceError('managed_provider_failed', 502);
  }
  const rawPayload = await response.text();
  if (rawPayload.length > PROVIDER_RESPONSE_LIMIT) {
    throw new MemberServiceError('managed_provider_failed', 502);
  }
  let payload: any = null;
  try {
    payload = rawPayload ? JSON.parse(rawPayload) : null;
  } catch {
    throw new MemberServiceError('managed_provider_failed', 502);
  }
  if (!response.ok) {
    console.error('Managed provider request failed:', response.status);
    throw new MemberServiceError('managed_provider_failed', 502);
  }
  return payload;
}

function extractOpenAICompatibleText(payload: any): string | null {
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content === 'string') return content.trim() || null;
  if (!Array.isArray(content)) return null;
  const text = content
    .map((part: any) => (typeof part?.text === 'string' ? part.text : ''))
    .join('')
    .trim();
  return text || null;
}

function dataUrlImage(value: unknown): { base64: string; mimeType: string } | null {
  if (typeof value !== 'string') return null;
  const match = value.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/);
  return match ? { mimeType: match[1], base64: match[2] } : null;
}

function extractOpenAICompatibleImage(payload: any): { base64: string; mimeType: string } | null {
  const message = payload?.choices?.[0]?.message;
  const candidates: unknown[] = [];
  if (Array.isArray(message?.content)) {
    for (const part of message.content) {
      candidates.push(part?.image_url?.url, part?.image_url, part?.url, part?.data);
    }
  }
  if (Array.isArray(message?.images)) {
    for (const image of message.images) {
      candidates.push(image?.image_url?.url, image?.image_url, image?.url, image?.data);
    }
  }
  if (typeof message?.content === 'string') {
    const embedded = message.content.match(/data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+/);
    if (embedded) candidates.push(embedded[0]);
  }
  if (Array.isArray(payload?.metadata)) {
    for (const metadata of payload.metadata) {
      for (const file of metadata?.event?.files || []) {
        const mimeType =
          typeof file?.filename === 'string' && /\.jpe?g$/i.test(file.filename)
            ? 'image/jpeg'
            : typeof file?.filename === 'string' && /\.webp$/i.test(file.filename)
              ? 'image/webp'
              : typeof file?.filename === 'string' && /\.png$/i.test(file.filename)
                ? 'image/png'
                : null;
        if (mimeType && typeof file?.content === 'string') {
          const dataUrl = dataUrlImage(file.content);
          if (dataUrl) return dataUrl;
          if (/^[A-Za-z0-9+/=]+$/.test(file.content)) {
            return { base64: file.content, mimeType };
          }
        }
      }
    }
  }
  for (const candidate of candidates) {
    const image = dataUrlImage(candidate);
    if (image) return image;
  }
  return null;
}

function extractMGAImageUrl(payload: any): string | null {
  if (!Array.isArray(payload?.metadata)) return null;
  for (const metadata of payload.metadata) {
    if (
      metadata?.action?.status !== 'end' ||
      metadata?.action?.tool_key !== 'img_generator' ||
      typeof metadata?.action?.data?.output !== 'string'
    ) {
      continue;
    }
    const match = metadata.action.data.output.match(/!\[[^\]]*\]\((https:\/\/[^)\s]+)\)/);
    if (match) return match[1];
  }
  return null;
}

function allowedMGAImageUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new MemberServiceError('managed_provider_failed', 502);
  }
  const allowedHost =
    process.env.MGA_IMAGE_HOST?.trim() ||
    'mygenassist-prod-generated-documents.s3.eu-central-1.amazonaws.com';
  if (url.protocol !== 'https:' || url.hostname !== allowedHost || url.username || url.password) {
    throw new MemberServiceError('managed_provider_failed', 502);
  }
  return url;
}

async function resolveMGAImage(payload: any): Promise<{ base64: string; mimeType: string } | null> {
  const embedded = extractOpenAICompatibleImage(payload);
  if (embedded) return embedded;
  const remoteUrl = extractMGAImageUrl(payload);
  if (!remoteUrl) return null;
  const allowedUrl = allowedMGAImageUrl(remoteUrl);
  const response = await fetch(allowedUrl, { signal: providerTimeout(), redirect: 'follow' });
  if (!response.ok || !response.url) throw new MemberServiceError('managed_provider_failed', 502);
  allowedMGAImageUrl(response.url);
  const mimeType = response.headers.get('content-type')?.split(';')[0] || '';
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(mimeType)) {
    throw new MemberServiceError('managed_provider_failed', 502);
  }
  const contentLength = Number(response.headers.get('content-length') || 0);
  if (contentLength > 3_500_000) throw new MemberServiceError('managed_image_too_large', 502);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.length || bytes.length > 3_500_000) {
    throw new MemberServiceError('managed_image_too_large', 502);
  }
  return { base64: bytes.toString('base64'), mimeType };
}

async function callMGAText(request: ProviderRequest) {
  const config = getMGAConfig();
  if (!config) return null;
  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    signal: providerTimeout(),
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: providerModel('MGA_TEXT_MODEL', 'glm-5.2'),
      messages: [
        {
          role: 'system',
          content:
            'Return exactly one valid JSON object matching the user-requested schema. Do not wrap JSON in Markdown fences or add prose.',
        },
        { role: 'user', content: request.prompt },
      ],
      stream: false,
      response_format: { type: 'json_object' },
      ...(request.reasoning === 'high' ? { reasoning_effort: 'high' } : {}),
    }),
  });
  return jsonOrProviderError(response);
}

async function callMGAImage(request: ProviderRequest) {
  const config = getMGAConfig();
  if (!config) return null;
  const imageModel =
    request.provider === 'nano-banana-pro'
      ? providerModel('MGA_IMAGEN_MODEL', 'imagen-4')
      : providerModel('MGA_GPT_IMAGE_MODEL', 'gpt-image-1');
  const content: Array<Record<string, unknown>> = [{ type: 'text', text: request.prompt }];
  for (const image of request.images || []) {
    content.push({
      type: 'image_url',
      image_url: { url: `data:${image.mimeType};base64,${image.data}` },
    });
  }
  const response = await fetch(`${config.baseUrl}/chat/agent`, {
    method: 'POST',
    signal: providerTimeout(),
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: providerModel('MGA_IMAGE_AGENT_MODEL', 'glm-5.2'),
      messages: [
        {
          role: 'system',
          content: `Use the img_generator tool exactly once with ${imageModel}. Return one final image.`,
        },
        { role: 'user', content },
      ],
      stream: false,
      tool_keys: ['img_generator'],
      hidden: true,
    }),
  });
  return jsonOrProviderError(response);
}

export async function callMGAResearchAgent(input: {
  prompt: string;
  enabledCapabilityIds: readonly string[];
}): Promise<ManagedGenerationOutput> {
  const config = getMGAConfig();
  if (!config) throw new MemberServiceError('managed_provider_unavailable', 503);
  const toolKeys = resolveResearchToolKeys(input.enabledCapabilityIds);
  const response = await fetch(`${config.baseUrl}/chat/agent`, {
    method: 'POST',
    signal: providerTimeout(),
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: providerModel('MGA_RESEARCH_AGENT_MODEL', 'glm-5'),
      messages: [
        {
          role: 'system',
          content:
            'Perform read-only research verification using only the enabled tools. Never invent evidence, citations, ethics approval, patient details, or dataset facts. Distinguish related literature from verification of the submitted study. Return only JSON matching the requested review schema.',
        },
        { role: 'user', content: input.prompt },
      ],
      stream: false,
      tool_keys: toolKeys,
      hidden: true,
    }),
  });
  const payload = await jsonOrProviderError(response);
  const text = extractOpenAICompatibleText(payload);
  if (!text) throw new MemberServiceError('managed_provider_empty_output', 502);
  return { type: 'text', text };
}

async function generateGeminiText(request: ProviderRequest): Promise<ManagedGenerationOutput> {
  const mgaPayload = await callMGAText(request);
  if (mgaPayload) {
    const text = extractOpenAICompatibleText(mgaPayload);
    if (!text) throw new MemberServiceError('managed_provider_empty_output', 502);
    return { type: 'text', text };
  }
  const model = providerModel('GEMINI_TEXT_MODEL', 'gemini-3.6-flash');
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: 'POST',
      signal: providerTimeout(),
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': providerSecret('GEMINI_API_KEY'),
      },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: request.prompt }] }],
        ...(request.reasoning === 'high'
          ? { generationConfig: { thinkingConfig: { thinkingLevel: 'high' } } }
          : {}),
      }),
    }
  );
  const payload = await jsonOrProviderError(response);
  const text = payload.candidates?.[0]?.content?.parts
    ?.map((part: { text?: string }) => part.text || '')
    .join('')
    .trim();
  if (!text) throw new MemberServiceError('managed_provider_empty_output', 502);
  return { type: 'text', text };
}

async function generateNanoBananaImage(request: ProviderRequest): Promise<ManagedGenerationOutput> {
  if (request.images?.length) {
    throw new MemberServiceError('invalid_generation_request', 400);
  }
  const mgaPayload = await callMGAImage(request);
  if (!mgaPayload) throw new MemberServiceError('managed_provider_unavailable', 503);
  const image = await resolveMGAImage(mgaPayload);
  if (!image) throw new MemberServiceError('managed_provider_empty_output', 502);
  return { type: 'image', ...image };
}

async function generateOpenAIImage(request: ProviderRequest): Promise<ManagedGenerationOutput> {
  const mgaPayload = await callMGAImage(request);
  if (mgaPayload) {
    const image = await resolveMGAImage(mgaPayload);
    if (!image) throw new MemberServiceError('managed_provider_empty_output', 502);
    return { type: 'image', ...image };
  }
  const headers = { Authorization: `Bearer ${providerSecret('OPENAI_API_KEY')}` };
  const model = providerModel('OPENAI_IMAGE_MODEL', 'gpt-image-1');
  let response: Response;

  if (request.images?.length) {
    const form = new FormData();
    form.set('model', model);
    form.set('prompt', request.prompt);
    form.set('size', request.size || '1024x1024');
    form.set('quality', 'high');
    request.images.forEach((image, index) => {
      const bytes = Buffer.from(image.data, 'base64');
      form.append(
        'image[]',
        new Blob([bytes], { type: image.mimeType }),
        `reference-${index + 1}.png`
      );
    });
    response = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      signal: providerTimeout(),
      headers,
      body: form,
    });
  } else {
    response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      signal: providerTimeout(),
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt: request.prompt,
        n: 1,
        size: request.size || '1024x1024',
        quality: 'high',
        output_format: 'png',
      }),
    });
  }

  const payload = await jsonOrProviderError(response);
  const base64 = payload.data?.[0]?.b64_json;
  if (!base64) throw new MemberServiceError('managed_provider_empty_output', 502);
  return { type: 'image', base64, mimeType: 'image/png' };
}

export function callManagedProvider(request: ProviderRequest): Promise<ManagedGenerationOutput> {
  switch (request.provider) {
    case 'gemini-3.6-flash':
      return generateGeminiText(request);
    case 'nano-banana-pro':
      return generateNanoBananaImage(request);
    case 'gpt-image-2':
      return generateOpenAIImage(request);
  }
}
