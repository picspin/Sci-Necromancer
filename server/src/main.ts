import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

/**
 * Nest.js Serverless Entry Point
 * Designed for AWS Lambda / Vercel Serverless Functions
 * Bundle size optimized for tree-shaking
 */
async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  // Enable CORS for frontend calls
  app.enableCors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    methods: ['GET', 'POST'],
    credentials: true,
  });

  // Global validation pipe for DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    })
  );

  // Serverless handler compatibility
  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`🚀 File Processing Service running on port ${port}`);
}

bootstrap();
