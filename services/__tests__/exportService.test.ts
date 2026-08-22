import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
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
      presentationGuidance: [
        'Slide 1: Overview',
        'Slide 2: Images',
        'Slide 3: Approach',
        'Slide 4: Pitfalls',
        'Slide 5: Summary',
      ],
      aiAssistance: {
        disclosureVersion: 'jama-2026-v1' as const,
        platform: {
          name: 'Sci-Necromancer' as const,
          project: 'picspin/Sci-Necromancer' as const,
          url: 'https://www.rad-sci.org' as const,
        },
        generatedAt: '2026-07-28T00:00:00.000Z',
        provider: 'openai' as const,
        model: 'gpt-5.1',
        modelType: 'large-language-model' as const,
        mode: 'standard' as const,
        operations: ['language editing'],
        boundaries: ['factual claims', 'statistics', 'references'],
        methodsDisclosureRequired: false,
        authorVerificationRequired: true as const,
      },
      aiAssistanceRecords: [
        {
          disclosureVersion: 'jama-2026-v1' as const,
          platform: {
            name: 'Sci-Necromancer' as const,
            project: 'picspin/Sci-Necromancer' as const,
            url: 'https://www.rad-sci.org' as const,
          },
          generatedAt: '2026-07-28T01:00:00.000Z',
          provider: 'mga' as const,
          providerDisplayName: 'MGA',
          model: 'glm-5',
          modelType: 'research-agent' as const,
          mode: 'standard' as const,
          operations: ['read-only literature verification'],
          boundaries: ['source data', 'factual claims', 'references'],
          methodsDisclosureRequired: true,
          authorVerificationRequired: true as const,
        },
      ],
    };

    const [pdf, docx] = await Promise.all([
      exportService.exportToPDF(data, 'RSNA'),
      exportService.exportToDocx(data, 'RSNA'),
    ]);

    expect(pdf.type).toBe('application/pdf');
    expect(pdf.size).toBeGreaterThan(0);
    const pdfBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(pdf);
    });
    const pdfDocument = await getDocument({ data: new Uint8Array(pdfBuffer) }).promise;
    const pdfTextParts: string[] = [];
    for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
      const page = await pdfDocument.getPage(pageNumber);
      const content = await page.getTextContent();
      pdfTextParts.push(...content.items.map((item) => ('str' in item ? item.str : '')));
    }
    const pdfText = pdfTextParts.join(' ');
    expect(pdfText).toContain('AI USE ACKNOWLEDGMENT');
    expect(pdfText).toContain('picspin/Sci-Necromancer');
    expect(pdfText).toContain('gpt-5.1');
    expect(pdfText).toContain('glm-5');
    expect(pdfText).toContain('Methods section');
    expect(docx.size).toBeGreaterThan(0);
    const docxBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(docx);
    });
    const archive = await JSZip.loadAsync(docxBuffer);
    const documentXml = await archive.file('word/document.xml')?.async('text');
    expect(documentXml).toContain('Slide 1: Overview');
    expect(documentXml).toContain('Slide 5: Summary');
    expect(documentXml).toContain('GENERATIVE AI NOTICE');
    expect(documentXml).toContain('AI USE ACKNOWLEDGMENT');
    expect(documentXml).toContain('picspin/Sci-Necromancer');
    expect(documentXml).toContain('gpt-5.1');
    expect(documentXml).toContain('glm-5');
    expect(documentXml).toContain('Methods section');
    expect(documentXml!.indexOf('AI USE ACKNOWLEDGMENT')).toBeGreaterThan(
      documentXml!.indexOf('ABSTRACT')
    );

    const markdown = exportService.exportToMarkdown(data, 'RSNA Education Exhibit');
    const markdownText = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsText(markdown);
    });
    expect(markdownText).toContain('Slide 1: Overview');
    expect(markdownText).toContain('Slide 5: Summary');
    expect(markdownText).toContain('GENERATIVE AI NOTICE');
    expect(markdownText).toContain('## AI USE ACKNOWLEDGMENT');
    expect(markdownText).toContain('picspin/Sci-Necromancer');
    expect(markdownText).toContain('gpt-5.1');
    expect(markdownText).toContain('glm-5');
    expect(markdownText).toContain('Methods section');

    const json = exportService.exportToJSON(data, 'RSNA', 'RSNA Education Exhibit');
    const jsonText = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsText(json);
    });
    const parsedJson = JSON.parse(jsonText);
    expect(parsedJson.aiAcknowledgement).toContain('picspin/Sci-Necromancer');
    expect(parsedJson.aiAcknowledgement).toContain('gpt-5.1');
    expect(parsedJson.aiAcknowledgement).toContain('glm-5');
    expect(parsedJson.aiAcknowledgements).toHaveLength(2);
    expect(parsedJson.methodsDisclosureNote).toContain('Methods section');
  });
});
