import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { ValidationPipe, Module, Controller, Get, Post, Body } from '@nestjs/common';
import express from 'express';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Inline simple controller for health check
@Controller()
class AppController {
  @Get()
  health() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Get('health')
  healthCheck() {
    return { status: 'ok', service: 'sci-necromancer-api' };
  }
}

// Inline Image Controller
@Controller('image')
class ImageController {
  @Post('generate')
  async generate(@Body() body: { prompt: string; image?: any; images?: any[] }) {
    const NANOBANA_API_KEY = process.env.NANOBANA_API_KEY || '';
    const MODEL = process.env.NANOBANA_MODEL || 'gemini-2.0-flash-exp-image-generation';

    if (!body.prompt) {
      return { success: false, error: 'Missing prompt' };
    }

    if (!body.image && (!body.images || body.images.length === 0)) {
      return { success: false, error: 'Missing image data' };
    }

    const apiKey = NANOBANA_API_KEY.split(',')[0]?.trim();
    if (!apiKey) {
      return { success: false, error: 'NANOBANA_API_KEY not configured' };
    }

    const baseUrl = 'https://generativelanguage.googleapis.com/v1beta';
    const parts: any[] = [];

    if (body.images && body.images.length > 0) {
      for (const img of body.images) {
        parts.push({ inline_data: { mime_type: img.mimeType, data: img.data } });
      }
    } else if (body.image) {
      parts.push({ inline_data: { mime_type: body.image.mimeType, data: body.image.data } });
    }

    parts.push({ text: body.prompt });

    try {
      const res = await fetch(`${baseUrl}/models/${MODEL}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
        }),
      });

      if (!res.ok) {
        return { success: false, error: `Google API error: ${res.status}` };
      }

      const data = await res.json();
      const responseParts = data.candidates?.[0]?.content?.parts || [];

      for (const part of responseParts) {
        if (part.inlineData?.data) {
          return { success: true, image: part.inlineData.data };
        }
      }

      return { success: false, error: 'No image in response' };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
}

@Module({
  controllers: [AppController, ImageController],
})
class AppModule {}

const expressApp = express();
let app: any;

async function bootstrap() {
  if (!app) {
    const adapter = new ExpressAdapter(expressApp);
    app = await NestFactory.create(AppModule, adapter, {
      logger: ['error', 'warn'],
    });

    app.use(express.json({ limit: '10mb' }));
    app.enableCors({ origin: '*' });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

    await app.init();
  }
  return expressApp;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const server = await bootstrap();
    server(req, res);
  } catch (error) {
    console.error('Bootstrap error:', error);
    res.status(500).json({ error: 'Server initialization failed', details: String(error) });
  }
}
