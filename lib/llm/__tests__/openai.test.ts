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
      const result = await analyzeContent('Test research content');

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
      localStorage.setItem('app-settings', JSON.stringify({ openAIApiKey: 'test-api-key' } as any));
      const result = await generateImage(
        { file: null, specs: '1024x1024', base64: null },
        'A scientific figure showing MRI results'
      );

      expect(typeof result).toBe('string');
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('siliconflow'),
        expect.any(Object)
      );
    });
  });

  describe('RSNA workflow', () => {
    it('normalizes RSNA analysis into the three-layer classification', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                categories: [
                  { name: 'Neuroradiology', type: 'main', probability: 0.91 },
                  { name: 'Physics', type: 'main', probability: 0.62 },
                ],
                keywords: ['AI', 'MRI'],
                rsna: {
                  track: 'regular',
                  contentType: 'science',
                  primaryPresentationFormat: 'scientific-paper',
                  alternativePresentationFormats: ['digital-presentation'],
                  reportingGuidelines: ['TRIPOD+AI for Abstracts'],
                  confidence: 0.84,
                  rationale: ['Prediction model study'],
                  warnings: [],
                },
              }),
            },
          },
        ],
      };
      global.fetch = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => mockResponse });

      const { analyzeRSNAContent } = await import('@/lib/llm/openai');
      const result = await analyzeRSNAContent('We externally validated an MRI prediction model.');

      expect(result.rsna.contentType).toBe('science');
      expect(result.rsna.reportingGuidelines).toContain('TRIPOD+AI for Abstracts');
      expect(result.keywords).toContain('Artificial Intelligence');
    });

    it('uses the RSNA factual-integrity prompt for generation', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                abstract: 'PURPOSE: To evaluate MRI.',
                impact: 'MRI may improve care.',
                synopsis: 'Factual synopsis.',
                keywords: ['MRI'],
                presentationGuidance: ['Prepare a concise oral results slide.'],
                complianceWarnings: ['Verify the provisional character limit.'],
              }),
            },
          },
        ],
      };
      global.fetch = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => mockResponse });

      const { generateRSNAAbstract } = await import('@/lib/llm/openai');
      const classification = {
        track: 'regular',
        contentType: 'science',
        primaryPresentationFormat: 'scientific-paper',
        alternativePresentationFormats: ['digital-presentation'],
        reportingGuidelines: [],
        confidence: 0.8,
        rationale: ['Research'],
        warnings: [],
        ruleVersion: 'RSNA-2026-provisional-2023-fallback',
      } as const;
      const result = await generateRSNAAbstract({
        inputText: 'Source facts',
        category: 'Neuroradiology',
        keywords: ['MRI'],
        classification,
        mode: 'standard',
      });

      const request = vi.mocked(global.fetch).mock.calls[0]?.[1] as RequestInit;
      expect(String(request.body)).toContain('Do not invent');
      expect(result.rsna).toEqual(classification);
      expect(result.presentationGuidance).toHaveLength(1);
      expect(result.aiAssistance).toMatchObject({
        provider: 'openai',
        mode: 'standard',
        authorVerificationRequired: true,
      });
    });
  });
});
