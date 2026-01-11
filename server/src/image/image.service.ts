import { Injectable, Logger } from '@nestjs/common';
import { GenerateNanobanaDto } from './dto/image-generation.dto';

/**
 * Image Service
 * Proxies requests to Google Gemini API for Nanobanana Pro image generation
 * API keys are read from environment variables (supports multiple comma-separated keys)
 */
@Injectable()
export class ImageService {
  private readonly logger = new Logger(ImageService.name);

  // Default model for image generation
  private readonly DEFAULT_MODEL = 'gemini-3-pro-image-preview';

  // Track failed API keys in this session (reset on server restart)
  private readonly failedApiKeys = new Set<string>();

  /**
   * Parse API keys from environment variable
   * Supports comma-separated keys for automatic fallback
   */
  private parseApiKeys(): string[] {
    const rawKeys = process.env.NANOBANA_API_KEY || '';
    if (!rawKeys || rawKeys === 'your_google_ai_api_key_here') {
      return [];
    }

    return rawKeys
      .split(',')
      .map((key: string) => key.trim())
      .filter((key: string) => key.length > 0 && key !== 'your_google_ai_api_key_here');
  }

  /**
   * Get the next available API key (skipping failed ones)
   */
  private getNextAvailableKey(): string | null {
    const allKeys = this.parseApiKeys();

    for (const key of allKeys) {
      if (!this.failedApiKeys.has(key)) {
        return key;
      }
    }

    // All keys have failed - reset and try first key again
    if (allKeys.length > 0 && this.failedApiKeys.size >= allKeys.length) {
      this.logger.log('All API keys exhausted, resetting failed keys list');
      this.failedApiKeys.clear();
      return allKeys[0];
    }

    return null;
  }

  /**
   * Mark an API key as failed
   */
  private markKeyAsFailed(key: string): void {
    this.failedApiKeys.add(key);
    const allKeys = this.parseApiKeys();
    const remainingKeys = allKeys.filter((k) => !this.failedApiKeys.has(k)).length;
    this.logger.log(`API key marked as failed. ${remainingKeys}/${allKeys.length} keys remaining.`);
  }

  /**
   * Generate image via Nanobanana Pro (Google Gemini) API
   * Proxies through backend to bypass browser network restrictions
   */
  async generateImage(
    dto: GenerateNanobanaDto
  ): Promise<{ success: boolean; image?: string; error?: string }> {
    const model = dto.model || this.DEFAULT_MODEL;
    const apiKey = this.getNextAvailableKey();

    if (!apiKey) {
      const allKeys = this.parseApiKeys();
      if (allKeys.length === 0) {
        return {
          success: false,
          error: 'Nanobana API key not configured. Set NANOBANA_API_KEY environment variable.',
        };
      }
      return { success: false, error: 'All API keys have failed. Please wait and try again.' };
    }

    // Build parts array for the request
    const parts: any[] = [];

    // Add image(s) to parts
    if (dto.images && dto.images.length > 0) {
      for (const img of dto.images) {
        parts.push({
          inline_data: {
            mime_type: img.mimeType,
            data: img.data,
          },
        });
      }
    } else if (dto.image) {
      parts.push({
        inline_data: {
          mime_type: dto.image.mimeType,
          data: dto.image.data,
        },
      });
    }

    // Add text prompt
    parts.push({ text: dto.prompt });

    // Build request body
    const requestBody = {
      contents: [
        {
          parts: parts,
        },
      ],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE'],
      },
    };

    const baseUrl = 'https://generativelanguage.googleapis.com/v1beta';

    try {
      this.logger.log(`Calling Nanobanana Pro API with model: ${model}`);

      const response = await fetch(`${baseUrl}/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`Nanobanana API error: ${response.status} - ${errorText}`);

        // Parse error and determine if we should mark key as failed
        try {
          const errorData = JSON.parse(errorText);
          const code = errorData.error?.code;

          if (code === 429 || code === 403) {
            // Rate limit or permission denied - mark key as failed
            this.markKeyAsFailed(apiKey);
          }
        } catch {
          // Ignore parse errors
        }

        return { success: false, error: `API call failed: ${response.status}` };
      }

      const data = await response.json();

      // Extract image from response
      const candidates = data.candidates;
      if (!candidates || candidates.length === 0) {
        return { success: false, error: 'No response from API' };
      }

      const responseParts = candidates[0]?.content?.parts;
      if (!responseParts || responseParts.length === 0) {
        return { success: false, error: 'No content in response' };
      }

      // Find the image part
      for (const part of responseParts) {
        if (part.inlineData?.data) {
          return { success: true, image: part.inlineData.data };
        }
      }

      return { success: false, error: 'No image data in response' };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Nanobanana generation error: ${errorMessage}`);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Health check for image service
   */
  healthCheck(): { status: string; apiKeysConfigured: number } {
    const keys = this.parseApiKeys();
    return {
      status: 'ok',
      apiKeysConfigured: keys.length,
    };
  }
}
