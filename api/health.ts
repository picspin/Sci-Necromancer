import { VercelRequest, VercelResponse } from '@vercel/node';

const NANOBANA_API_KEY = process.env.NANOBANA_API_KEY || '';

export default async function handler(request: VercelRequest, response: VercelResponse) {
  response.setHeader('Access-Control-Allow-Origin', '*');

  const keys =
    NANOBANA_API_KEY && NANOBANA_API_KEY !== 'your_google_ai_api_key_here'
      ? NANOBANA_API_KEY.split(',').filter((k) => k.trim()).length
      : 0;

  return response.status(200).json({
    status: 'ok',
    apiKeysConfigured: keys,
    model: process.env.NANOBANA_MODEL || 'gemini-3-pro-image-preview',
  });
}
