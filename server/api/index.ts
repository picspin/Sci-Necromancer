import type { VercelRequest, VercelResponse } from './vercelTypes.js';

// Environment variables
const NANOBANA_API_KEY = process.env.NANOBANA_API_KEY || '';
const MODEL = process.env.NANOBANA_MODEL || 'gemini-2.0-flash-exp-image-generation';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const path = req.url?.split('?')[0] || '/';

  // Health check endpoints
  if (req.method === 'GET' && (path === '/' || path === '/api' || path === '/api/index')) {
    return res.status(200).json({
      status: 'ok',
      service: 'sci-necromancer-api',
      timestamp: new Date().toISOString(),
    });
  }

  if (req.method === 'GET' && path === '/api/health') {
    return res.status(200).json({
      status: 'ok',
      apiKeysConfigured: NANOBANA_API_KEY
        ? NANOBANA_API_KEY.split(',').filter((k) => k.trim()).length
        : 0,
      model: MODEL,
    });
  }

  // Image generation endpoint
  if (req.method === 'POST' && (path === '/api/image/generate' || path === '/image/generate')) {
    const { prompt, image, images, model } = req.body || {};

    if (!prompt) {
      return res.status(400).json({ success: false, error: 'Missing prompt' });
    }

    // Allow text-only generation (some models support it)
    const hasImages = image || (images && images.length > 0);

    const apiKey = NANOBANA_API_KEY.split(',')[0]?.trim();
    if (!apiKey) {
      return res.status(500).json({
        success: false,
        error: 'NANOBANA_API_KEY not configured in environment variables',
      });
    }

    const selectedModel = model || MODEL;
    const baseUrl = 'https://generativelanguage.googleapis.com/v1beta';

    // Build request parts
    const parts: any[] = [];

    if (images && images.length > 0) {
      for (const img of images) {
        parts.push({ inline_data: { mime_type: img.mimeType, data: img.data } });
      }
    } else if (image) {
      parts.push({ inline_data: { mime_type: image.mimeType, data: image.data } });
    }

    parts.push({ text: prompt });

    // Log for debugging
    console.log('Image generation request:', {
      hasImages,
      imageCount: images?.length || (image ? 1 : 0),
      model: selectedModel,
      promptLength: prompt.length,
    });

    try {
      const apiRes = await fetch(
        `${baseUrl}/models/${selectedModel}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts }],
            generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
          }),
        }
      );

      if (!apiRes.ok) {
        const errorText = await apiRes.text();
        console.error('Google API error:', apiRes.status, errorText);
        return res.status(apiRes.status).json({
          success: false,
          error: `Google API error: ${apiRes.status}`,
        });
      }

      const data = await apiRes.json();
      const responseParts = data.candidates?.[0]?.content?.parts || [];

      for (const part of responseParts) {
        if (part.inlineData?.data) {
          return res.status(200).json({
            success: true,
            image: part.inlineData.data,
          });
        }
      }

      return res.status(500).json({ success: false, error: 'No image in response' });
    } catch (error) {
      console.error('Fetch error:', error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // 404 for unknown routes
  return res.status(404).json({ error: 'Not found', path });
}
