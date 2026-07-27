import { describe, expect, it } from 'vitest';
import exportService from '../exportService';

describe('ExportService AI provenance', () => {
  it('includes the AI verification disclaimer in exported JSON by default', async () => {
    const blob = exportService.exportToJSON(
      {
        impact: 'Clinical relevance.',
        synopsis: 'Synopsis.',
        abstract: 'PURPOSE: Test.',
        keywords: ['MRI'],
      },
      'RSNA',
      'RSNA Science Abstract'
    );

    const content = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsText(blob);
    });
    expect(content).toContain('AI-assisted draft');
    expect(content).toContain('does not guarantee factual accuracy');
  });

  it('exports PDF and DOCX with the full abstract without runtime errors', async () => {
    const data = {
      impact: 'Clinical relevance.',
      synopsis: 'Synopsis.',
      abstract: 'PURPOSE: Test. MATERIALS AND METHODS: Test. RESULTS: Test. CONCLUSION: Test.',
      keywords: ['MRI'],
      aiAssistance: {
        generatedAt: '2026-07-28T00:00:00.000Z',
        provider: 'openai' as const,
        model: 'test-model',
        mode: 'standard' as const,
        operations: ['language editing'],
        authorVerificationRequired: true as const,
      },
    };

    const [pdf, docx] = await Promise.all([
      exportService.exportToPDF(data, 'RSNA'),
      exportService.exportToDocx(data, 'RSNA'),
    ]);

    expect(pdf.type).toBe('application/pdf');
    expect(pdf.size).toBeGreaterThan(0);
    expect(docx.size).toBeGreaterThan(0);
  });
});
