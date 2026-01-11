import { Controller, Post, Body, HttpCode, HttpStatus, BadRequestException } from '@nestjs/common';
import { ImageService } from './image.service';
import { GenerateNanobanaDto, NanobanaResponseDto } from './dto/image-generation.dto';

/**
 * Image Generation Controller
 * Provides proxy endpoints for Nanobanana Pro (Google Gemini) image generation
 * Bypasses browser network restrictions by routing through backend
 */
@Controller('api/image')
export class ImageController {
  constructor(private readonly imageService: ImageService) {}

  /**
   * Generate image via Nanobanana Pro proxy
   * POST /api/image/nanobana
   *
   * @param dto - Image generation request with prompt and optional image(s)
   * @returns Generated image as base64 string or error
   */
  @Post('nanobana')
  @HttpCode(HttpStatus.OK)
  async generateNanobana(@Body() dto: GenerateNanobanaDto): Promise<NanobanaResponseDto> {
    // Validate required fields
    if (!dto.prompt) {
      throw new BadRequestException('Missing required field: prompt');
    }

    // Check for images (either single image or multiple images)
    const hasImage = dto.image || (dto.images && dto.images.length > 0);

    if (!hasImage) {
      throw new BadRequestException('Missing image data: provide either "image" or "images" field');
    }

    // Validate single image if provided
    if (dto.image && (!dto.image.mimeType || !dto.image.data)) {
      throw new BadRequestException('Invalid image: must have mimeType and data fields');
    }

    // Validate multiple images if provided
    if (dto.images) {
      for (let i = 0; i < dto.images.length; i++) {
        const img = dto.images[i];
        if (!img.mimeType || !img.data) {
          throw new BadRequestException(
            `Invalid image at index ${i}: must have mimeType and data fields`
          );
        }
      }
    }

    const result = await this.imageService.generateImage(dto);

    if (!result.success) {
      return {
        success: false,
        error: result.error,
      };
    }

    return {
      success: true,
      image: result.image,
    };
  }

  /**
   * Health check endpoint
   * POST /api/image/health
   */
  @Post('health')
  @HttpCode(HttpStatus.OK)
  healthCheck(): { status: string; apiKeysConfigured: number } {
    return this.imageService.healthCheck();
  }
}
