import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Settings } from '@/types';

// Mock settings
const mockSettings: Settings = {
  provider: 'openai',
  openAIApiKey: 'test-api-key',
  openAIBaseUrl: 'https://api.openai.com/v1',
  openAITextModel: 'gpt-4o',
  openAIVisionModel: 'gpt-4o',
  openAIImageModel: 'dall-e-3',
  temperature: 0.7,
  maxTokens: 4000,
};

describe('OpenAI LLM Service', () => {
  beforeEach(() => {
    localStorage.setItem('app-settings', JSON.stringify(mockSettings));
    vi.clearAllMocks();
  });

  describe('analyzeContent', () => {
    it('should call OpenAI API with correct parameters', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                categories: [{ name: 'MRI', type: 'main', probability: 0.9 }],
                keywords: ['imaging', 'brain'],
              }),
            },
          },
        ],
      };

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const { analyzeContent } = await import('@/lib/llm/openai');
      const result = await analyzeContent('Test research content', 'ISMRM');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-api-key',
            'Content-Type': 'application/json',
          }),
        })
      );

      expect(result.categories).toHaveLength(1);
      expect(result.keywords).toContain('imaging');
    });

    it('should handle API errors gracefully', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      });

      const { analyzeContent } = await import('@/lib/llm/openai');

      await expect(analyzeContent('Test content', 'ISMRM')).rejects.toThrow();
    });
  });

  describe('generateAbstract', () => {
    it('should generate abstract with provided parameters', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: '## Background\nTest abstract content...',
            },
          },
        ],
      };

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const { generateFinalAbstract } = await import('@/lib/llm/openai');
      const result = await generateFinalAbstract(
        'Test input',
        'ISMRM',
        'Standard Abstract',
        [],
        [],
        'Test impact',
        'Test synopsis'
      );

      expect(result.abstract).toContain('Background');
      expect(global.fetch).toHaveBeenCalled();
    });
  });

  describe('generateImage', () => {
    it('should generate image with SiliconFlow API', async () => {
      const mockImageResponse = {
        images: [
          {
            url: 'https://example.com/generated-image.png',
          },
        ],
      };

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockImageResponse,
      });

      const { generateImage } = await import('@/lib/llm/openai');
      const result = await generateImage('A scientific figure showing MRI results');

      expect(result).toContain('https://');
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('siliconflow'),
        expect.any(Object)
      );
    });
  });
});
