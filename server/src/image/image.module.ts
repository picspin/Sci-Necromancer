import { Module } from '@nestjs/common';
import { ImageController } from './image.controller';
import { ImageService } from './image.service';

/**
 * Image Generation Module
 * Provides proxy endpoints for Nanobanana Pro (Google Gemini) image generation
 * Bypasses browser network restrictions by routing through backend
 */
@Module({
  controllers: [ImageController],
  providers: [ImageService],
  exports: [ImageService],
})
export class ImageModule {}
