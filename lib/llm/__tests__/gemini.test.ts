import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Settings } from '@/types';

const { generateContentMock } = vi.hoisted(() => ({
  generateContentMock: vi.fn(),
}));

vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    models = { generateContent: generateContentMock };
  },
}));

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
    generateContentMock.mockResolvedValue({ text: '' });
  });

  describe('analyzeContent', () => {
    it('should analyze content and extract categories', async () => {
      generateContentMock.mockResolvedValue({
        text: JSON.stringify({
          categories: [{ name: 'Neuro', type: 'main', probability: 0.95 }],
          keywords: ['fMRI', 'brain', 'connectivity'],
        }),
      });

      const { analyzeContent } = await import('@/lib/llm/gemini');
      const result = await analyzeContent('Functional MRI study of brain connectivity');

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
      generateContentMock.mockResolvedValue({
        text: '## Background\nNovel fMRI technique...\n\n## Methods\nWe developed...',
      });

      const { generateFinalAbstract } = await import('@/lib/llm/gemini');
      const result = await generateFinalAbstract(
        'Research input',
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

  describe('generateImage', () => {
    it('uses the configured Google BYOK image model', async () => {
      localStorage.setItem(
        'app-settings',
        JSON.stringify({ ...mockSettings, googleImageModel: 'gemini-custom-image' })
      );
      generateContentMock.mockResolvedValue({
        candidates: [{ content: { parts: [{ inlineData: { data: 'image-base64' } }] } }],
      });

      const { generateImage } = await import('@/lib/llm/gemini');
      await expect(
        generateImage({ file: null, specs: 'diagram', base64: null }, 'clinical pathway')
      ).resolves.toBe('image-base64');
      expect(generateContentMock).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'gemini-custom-image' })
      );
    });
  });
});
