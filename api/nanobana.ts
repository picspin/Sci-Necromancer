import { VercelRequest, VercelResponse } from '@vercel/node';

// Environment variables (set in Vercel dashboard)
const NANOBANA_API_KEY = process.env.NANOBANA_API_KEY || '';
const MODEL = process.env.NANOBANA_MODEL || 'gemini-3-pro-image-preview';

const failedApiKeys = new Set<string>();

function parseApiKeys(): string[] {
  if (!NANOBANA_API_KEY || NANOBANA_API_KEY === 'your_google_ai_api_key_here') {
    return [];
  }
  return NANOBANA_API_KEY.split(',')
    .map((k) => k.trim())
    .filter((k) => k.length > 0 && k !== 'your_google_ai_api_key_here');
}

function getNextAvailableKey(): string | null {
  const keys = parseApiKeys();
  for (const key of keys) {
    if (!failedApiKeys.has(key)) return key;
  }
  if (keys.length > 0 && failedApiKeys.size >= keys.length) {
    failedApiKeys.clear();
    return keys[0];
  }
  return null;
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
  // CORS
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (request.method === 'OPTIONS') {
    return response.status(200).send('OK');
  }

  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method not allowed' });
  }

  const { prompt, image, images, model } = request.body;

  if (!prompt) {
    return response.status(400).json({ success: false, error: 'Missing prompt' });
  }

  if (!image && (!images || images.length === 0)) {
    return response.status(400).json({ success: false, error: 'Missing image data' });
  }

  const apiKey = getNextAvailableKey();
  if (!apiKey) {
    const keys = parseApiKeys();
    if (keys.length === 0) {
      return response.status(500).json({
        success: false,
        error: 'NANOBANA_API_KEY not configured in Vercel environment variables',
      });
    }
    return response.status(500).json({
      success: false,
      error: 'All API keys failed. Please wait and try again.',
    });
  }

  const selectedModel = model || MODEL;
  const baseUrl = 'https://generativelanguage.googleapis.com/v1beta';

  // Build parts
  const parts: any[] = [];

  if (images && images.length > 0) {
    for (const img of images) {
      parts.push({ inline_data: { mime_type: img.mimeType, data: img.data } });
    }
  } else if (image) {
    parts.push({ inline_data: { mime_type: image.mimeType, data: image.data } });
  }

  parts.push({ text: prompt });

  try {
    const res = await fetch(`${baseUrl}/models/${selectedModel}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error('Google API error:', res.status, errorText);

      if (res.status === 429 || res.status === 403) {
        failedApiKeys.add(apiKey);
      }

      return response.status(res.status).json({
        success: false,
        error: `Google API error: ${res.status}`,
      });
    }

    const data = await res.json();
    const candidates = data.candidates || [];
    const responseParts = candidates[0]?.content?.parts || [];

    for (const part of responseParts) {
      if (part.inlineData?.data) {
        return response.status(200).json({
          success: true,
          image: part.inlineData.data,
        });
      }
    }

    return response.status(500).json({
      success: false,
      error: 'No image in response',
    });
  } catch (error) {
    console.error('Fetch error:', error);
    return response.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
