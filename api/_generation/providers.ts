import { MemberServiceError } from '../_member/memberService';
import type { ManagedGenerationOutput, ManagedProvider } from './managedGeneration';

export interface ProviderImageInput {
  data: string;
  mimeType: string;
}

export interface ProviderRequest {
  provider: ManagedProvider;
  prompt: string;
  images?: ProviderImageInput[];
  size?: '1024x1024' | '1024x1536' | '1536x1024';
}

const providerTimeout = () => AbortSignal.timeout(105_000);

function providerSecret(name: 'GEMINI_API_KEY' | 'OPENAI_API_KEY'): string {
  const value = process.env[name]?.trim();
  if (!value) throw new MemberServiceError('managed_provider_unavailable', 503);
  return value;
}

async function jsonOrProviderError(response: Response): Promise<any> {
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    console.error('Managed provider request failed:', response.status, payload?.error?.message);
    throw new MemberServiceError('managed_provider_failed', 502);
  }
  return payload;
}

async function generateGeminiText(prompt: string): Promise<ManagedGenerationOutput> {
  const response = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent',
    {
      method: 'POST',
      signal: providerTimeout(),
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': providerSecret('GEMINI_API_KEY'),
      },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }] }),
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
  const parts = (request.images || []).map((image) => ({
    inlineData: { mimeType: image.mimeType, data: image.data },
  }));
  parts.push({ text: request.prompt } as any);

  const response = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image:generateContent',
    {
      method: 'POST',
      signal: providerTimeout(),
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': providerSecret('GEMINI_API_KEY'),
      },
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
      }),
    }
  );
  const payload = await jsonOrProviderError(response);
  const imagePart = payload.candidates?.[0]?.content?.parts?.find(
    (part: { inlineData?: { data?: string } }) => part.inlineData?.data
  );
  if (!imagePart?.inlineData?.data) {
    throw new MemberServiceError('managed_provider_empty_output', 502);
  }
  return {
    type: 'image',
    base64: imagePart.inlineData.data,
    mimeType: imagePart.inlineData.mimeType || 'image/png',
  };
}

async function generateOpenAIImage(request: ProviderRequest): Promise<ManagedGenerationOutput> {
  const headers = { Authorization: `Bearer ${providerSecret('OPENAI_API_KEY')}` };
  let response: Response;

  if (request.images?.length) {
    const form = new FormData();
    form.set('model', 'gpt-image-2');
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
        model: 'gpt-image-2',
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
      return generateGeminiText(request.prompt);
    case 'nano-banana-pro':
      return generateNanoBananaImage(request);
    case 'gpt-image-2':
      return generateOpenAIImage(request);
  }
}
