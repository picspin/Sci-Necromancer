import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Settings } from '@/types';

const mockSettings: Settings = {
  provider: 'google',
  googleApiKey: 'test-google-api-key',
  model: 'gemini-2.5-flash',
  temperature: 0.7,
  maxTokens: 4000,
};

describe('Gemini LLM Service', () => {
  beforeEach(() => {
    localStorage.setItem('app-settings', JSON.stringify(mockSettings));
    vi.clearAllMocks();
  });

  describe('analyzeContent', () => {
    it('should analyze content and extract categories', async () => {
      // Mock Google AI SDK
      vi.mock('@google/genai', () => ({
        GoogleGenerativeAI: vi.fn().mockImplementation(() => ({
          getGenerativeModel: vi.fn().mockReturnValue({
            generateContent: vi.fn().mockResolvedValue({
              response: {
                text: () =>
                  JSON.stringify({
                    categories: [{ name: 'Neuro', type: 'main', probability: 0.95 }],
                    keywords: ['fMRI', 'brain', 'connectivity'],
                  }),
              },
            }),
          }),
        })),
      }));

      const { analyzeContent } = await import('@/lib/llm/gemini');
      const result = await analyzeContent('Functional MRI study of brain connectivity', 'ISMRM');

      expect(result.categories).toBeDefined();
      expect(result.keywords).toBeInstanceOf(Array);
    });

    it('should handle missing API key', async () => {
      localStorage.setItem(
        'app-settings',
        JSON.stringify({
          provider: 'google',
          googleApiKey: '',
        })
      );

      const { analyzeContent } = await import('@/lib/llm/gemini');

      await expect(analyzeContent('Test content', 'ISMRM')).rejects.toThrow();
    });
  });

  describe('generateAbstract', () => {
    it('should generate structured abstract', async () => {
      vi.mock('@google/genai', () => ({
        GoogleGenerativeAI: vi.fn().mockImplementation(() => ({
          getGenerativeModel: vi.fn().mockReturnValue({
            generateContent: vi.fn().mockResolvedValue({
              response: {
                text: () => '## Background\nNovel fMRI technique...\n\n## Methods\nWe developed...',
              },
            }),
          }),
        })),
      }));

      const { generateFinalAbstract } = await import('@/lib/llm/gemini');
      const result = await generateFinalAbstract(
        'Research input',
        'ISMRM',
        'Standard Abstract',
        [],
        [],
        'Impact statement',
        'Synopsis'
      );

      expect(result.abstract).toBeTruthy();
      expect(result.abstract).toContain('Background');
    });
  });
});
