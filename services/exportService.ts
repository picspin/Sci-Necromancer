import jsPDF from 'jspdf';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';
import { AbstractData, Conference, AbstractType } from '../types';
import { AI_EXPORT_DISCLAIMER } from '../lib/compliance/aiDisclosure';

export interface ConferenceTemplate {
  name: string;
  wordLimits: {
    impact: number;
    synopsis: number;
  };
  formatting: {
    fontSize: number;
    fontFamily: string;
    margins: {
      top: number;
      right: number;
      bottom: number;
      left: number;
    };
  };
  structure: {
    includeKeywords: boolean;
    keywordFormat: 'list' | 'inline';
    sectionSeparator: string;
  };
}

export interface ExportOptions {
  format?: 'pdf' | 'docx' | 'json';
  template?: ConferenceTemplate;
  includeMetadata?: boolean;
  customTitle?: string;
}

export interface ExportMetadata {
  exportDate: string;
  conference: Conference;
  abstractType: AbstractType;
  wordCount: {
    impact: number;
    synopsis: number;
    total: number;
  };
}

class ExportService {
  private templates: Map<Conference, ConferenceTemplate> = new Map();

  constructor() {
    this.initializeTemplates();
  }

  private initializeTemplates(): void {
    // ISMRM Template
    this.templates.set('ISMRM', {
      name: 'ISMRM',
      wordLimits: {
        impact: 100,
        synopsis: 300,
      },
      formatting: {
        fontSize: 12,
        fontFamily: 'Times New Roman',
        margins: {
          top: 72,
          right: 72,
          bottom: 72,
          left: 72,
        },
      },
      structure: {
        includeKeywords: true,
        keywordFormat: 'list',
        sectionSeparator: '---',
      },
    });

    // RSNA Template
    this.templates.set('RSNA', {
      name: 'RSNA',
      wordLimits: {
        impact: 150,
        synopsis: 350,
      },
      formatting: {
        fontSize: 11,
        fontFamily: 'Arial',
        margins: {
          top: 72,
          right: 72,
          bottom: 72,
          left: 72,
        },
      },
      structure: {
        includeKeywords: true,
        keywordFormat: 'inline',
        sectionSeparator: '',
      },
    });

    // JACC Template
    this.templates.set('JACC', {
      name: 'JACC',
      wordLimits: {
        impact: 200,
        synopsis: 400,
      },
      formatting: {
        fontSize: 12,
        fontFamily: 'Times New Roman',
        margins: {
          top: 72,
          right: 72,
          bottom: 72,
          left: 72,
        },
      },
      structure: {
        includeKeywords: false,
        keywordFormat: 'inline',
        sectionSeparator: '',
      },
    });
  }

  public getTemplate(conference: Conference): ConferenceTemplate {
    return this.templates.get(conference) || this.templates.get('ISMRM')!;
  }

  public async exportToPDF(
    data: AbstractData,
    conference: Conference = 'ISMRM',
    options: Partial<ExportOptions> = {}
  ): Promise<Blob> {
    const template = this.getTemplate(conference);
    const doc = new jsPDF();
    const pdfFontFamily = template.formatting.fontFamily === 'Arial' ? 'helvetica' : 'times';

    // Set font
    doc.setFont(pdfFontFamily);
    doc.setFontSize(template.formatting.fontSize);

    let yPosition = 30;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageBottom = doc.internal.pageSize.getHeight() - 20;
    const ensurePageSpace = (requiredHeight = 12) => {
      if (yPosition + requiredHeight > pageBottom) {
        doc.addPage();
        yPosition = 25;
      }
    };
    const margins = template.formatting.margins;
    const textWidth = pageWidth - margins.left / 2.83 - margins.right / 2.83; // Convert points to mm

    // Title
    if (options.customTitle) {
      doc.setFontSize(16);
      doc.text(options.customTitle, pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 15;
      doc.setFontSize(template.formatting.fontSize);
    }

    if (data.title) {
      doc.setFont(pdfFontFamily, 'bold');
      doc.text('TITLE', 20, yPosition);
      yPosition += 10;
      doc.setFont(pdfFontFamily, 'normal');
      const titleLines = doc.splitTextToSize(data.title, textWidth);
      doc.text(titleLines, 20, yPosition);
      yPosition += titleLines.length * 6 + 10;
    }

    // Impact Section
    doc.setFont(pdfFontFamily, 'bold');
    doc.text('IMPACT', 20, yPosition);
    yPosition += 10;

    doc.setFont(pdfFontFamily, 'normal');
    const impactLines = doc.splitTextToSize(data.impact, textWidth);
    doc.text(impactLines, 20, yPosition);
    yPosition += impactLines.length * 6 + 10;

    // Section separator
    if (template.structure.sectionSeparator) {
      doc.text(template.structure.sectionSeparator, 20, yPosition);
      yPosition += 10;
    }

    // Synopsis Section
    doc.setFont(pdfFontFamily, 'bold');
    doc.text('SYNOPSIS', 20, yPosition);
    yPosition += 10;

    doc.setFont(pdfFontFamily, 'normal');
    const synopsisLines = doc.splitTextToSize(data.synopsis, textWidth);
    doc.text(synopsisLines, 20, yPosition);
    yPosition += synopsisLines.length * 6 + 10;

    if (data.abstract) {
      ensurePageSpace(25);
      doc.setFont(pdfFontFamily, 'bold');
      doc.text('ABSTRACT', 20, yPosition);
      yPosition += 10;
      doc.setFont(pdfFontFamily, 'normal');
      const abstractLines = doc.splitTextToSize(data.abstract, textWidth) as string[];
      for (const line of abstractLines) {
        ensurePageSpace(6);
        doc.text(line, 20, yPosition);
        yPosition += 6;
      }
      yPosition += 10;
    }

    if (data.presentationGuidance?.length) {
      ensurePageSpace(25);
      doc.setFont(pdfFontFamily, 'bold');
      doc.text('PRESENTATION GUIDANCE / REVIEW PDF PLAN', 20, yPosition);
      yPosition += 10;
      doc.setFont(pdfFontFamily, 'normal');
      for (const item of data.presentationGuidance) {
        const itemLines = doc.splitTextToSize(`- ${item}`, textWidth) as string[];
        for (const line of itemLines) {
          ensurePageSpace(6);
          doc.text(line, 20, yPosition);
          yPosition += 6;
        }
      }
      yPosition += 10;
    }

    // Keywords Section
    if (template.structure.includeKeywords && data.keywords.length > 0) {
      ensurePageSpace(25);
      if (template.structure.sectionSeparator) {
        doc.text(template.structure.sectionSeparator, 20, yPosition);
        yPosition += 10;
      }

      doc.setFont(pdfFontFamily, 'bold');
      doc.text('KEYWORDS', 20, yPosition);
      yPosition += 10;

      doc.setFont(pdfFontFamily, 'normal');

      if (template.structure.keywordFormat === 'list') {
        data.keywords.forEach((keyword) => {
          ensurePageSpace(6);
          doc.text(`- ${keyword}`, 25, yPosition);
          yPosition += 6;
        });
      } else {
        const keywordText = data.keywords.join(', ');
        const keywordLines = doc.splitTextToSize(keywordText, textWidth) as string[];
        for (const line of keywordLines) {
          ensurePageSpace(6);
          doc.text(line, 20, yPosition);
          yPosition += 6;
        }
        yPosition += 10;
      }
    }

    ensurePageSpace(35);
    doc.setFont(pdfFontFamily, 'bold');
    doc.text('GENERATIVE AI NOTICE', 20, yPosition);
    yPosition += 8;
    doc.setFont(pdfFontFamily, 'normal');
    doc.setFontSize(9);
    const disclaimerLines = doc.splitTextToSize(AI_EXPORT_DISCLAIMER, textWidth);
    doc.text(disclaimerLines, 20, yPosition);

    return new Promise((resolve) => {
      const pdfBlob = doc.output('blob');
      resolve(pdfBlob);
    });
  }

  public async exportToDocx(
    data: AbstractData,
    conference: Conference = 'ISMRM',
    options: Partial<ExportOptions> = {}
  ): Promise<Blob> {
    const template = this.getTemplate(conference);

    const children: Paragraph[] = [];

    // Title
    if (options.customTitle) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: options.customTitle,
              bold: true,
              size: 32, // 16pt in half-points
            }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { after: 240 },
        })
      );
    }

    if (data.title) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: 'TITLE', bold: true, size: template.formatting.fontSize * 2 }),
          ],
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 240, after: 120 },
        }),
        new Paragraph({
          children: [new TextRun({ text: data.title, size: template.formatting.fontSize * 2 })],
          spacing: { after: 240 },
        })
      );
    }

    // Impact Section
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: 'IMPACT',
            bold: true,
            size: template.formatting.fontSize * 2,
          }),
        ],
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 240, after: 120 },
      })
    );

    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: data.impact,
            size: template.formatting.fontSize * 2,
          }),
        ],
        spacing: { after: 240 },
      })
    );

    // Synopsis Section
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: 'SYNOPSIS',
            bold: true,
            size: template.formatting.fontSize * 2,
          }),
        ],
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 240, after: 120 },
      })
    );

    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: data.synopsis,
            size: template.formatting.fontSize * 2,
          }),
        ],
        spacing: { after: 240 },
      })
    );

    if (data.abstract) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: 'ABSTRACT',
              bold: true,
              size: template.formatting.fontSize * 2,
            }),
          ],
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 240, after: 120 },
        }),
        new Paragraph({
          children: [new TextRun({ text: data.abstract, size: template.formatting.fontSize * 2 })],
          spacing: { after: 240 },
        })
      );
    }

    if (data.presentationGuidance?.length) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: 'PRESENTATION GUIDANCE / REVIEW PDF PLAN',
              bold: true,
              size: template.formatting.fontSize * 2,
            }),
          ],
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 240, after: 120 },
        }),
        ...data.presentationGuidance.map(
          (item) =>
            new Paragraph({
              children: [
                new TextRun({ text: `- ${item}`, size: template.formatting.fontSize * 2 }),
              ],
              spacing: { after: 60 },
            })
        )
      );
    }

    // Keywords Section
    if (template.structure.includeKeywords && data.keywords.length > 0) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: 'KEYWORDS',
              bold: true,
              size: template.formatting.fontSize * 2,
            }),
          ],
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 240, after: 120 },
        })
      );

      if (template.structure.keywordFormat === 'list') {
        data.keywords.forEach((keyword) => {
          children.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: `• ${keyword}`,
                  size: template.formatting.fontSize * 2,
                }),
              ],
              spacing: { after: 60 },
            })
          );
        });
      } else {
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: data.keywords.join(', '),
                size: template.formatting.fontSize * 2,
              }),
            ],
            spacing: { after: 240 },
          })
        );
      }
    }

    children.push(
      new Paragraph({
        children: [new TextRun({ text: 'GENERATIVE AI NOTICE', bold: true, size: 18 })],
        spacing: { before: 360, after: 100 },
      }),
      new Paragraph({
        children: [new TextRun({ text: AI_EXPORT_DISCLAIMER, italics: true, size: 18 })],
      })
    );

    const doc = new Document({
      sections: [
        {
          properties: {
            page: {
              margin: {
                top: template.formatting.margins.top * 20, // Convert points to twips
                right: template.formatting.margins.right * 20,
                bottom: template.formatting.margins.bottom * 20,
                left: template.formatting.margins.left * 20,
              },
            },
          },
          children,
        },
      ],
    });

    return await Packer.toBlob(doc);
  }

  public exportToJSON(
    data: AbstractData,
    conference: Conference = 'ISMRM',
    abstractType: AbstractType = 'Standard Abstract',
    options: Partial<ExportOptions> = {}
  ): Blob {
    const metadata: ExportMetadata = {
      exportDate: new Date().toISOString(),
      conference,
      abstractType,
      wordCount: {
        impact: this.countWords(data.impact),
        synopsis: this.countWords(data.synopsis),
        total: this.countWords(data.impact) + this.countWords(data.synopsis),
      },
    };

    const exportData = {
      abstract: data,
      aiDisclaimer: AI_EXPORT_DISCLAIMER,
      metadata: options.includeMetadata ? metadata : undefined,
      template: this.getTemplate(conference),
    };

    const jsonString = JSON.stringify(exportData, null, 2);
    return new Blob([jsonString], { type: 'application/json;charset=utf-8' });
  }

  public exportToMarkdown(
    data: AbstractData,
    abstractType: AbstractType = 'Standard Abstract'
  ): Blob {
    const sections = [
      `# ${abstractType}`,
      data.title ? `## TITLE\n\n${data.title}` : '',
      `## IMPACT\n\n${data.impact}`,
      `## SYNOPSIS\n\n${data.synopsis}`,
      data.abstract ? `## ABSTRACT\n\n${data.abstract}` : '',
      data.presentationGuidance?.length
        ? `## PRESENTATION GUIDANCE / REVIEW PDF PLAN\n\n${data.presentationGuidance.map((item) => `- ${item}`).join('\n')}`
        : '',
      `## KEYWORDS\n\n${data.keywords.map((keyword) => `- ${keyword}`).join('\n')}`,
      data.categories?.length
        ? `## CATEGORIES\n\n${data.categories.map((category) => `- ${category.name} (${category.type})`).join('\n')}`
        : '',
      `## GENERATIVE AI NOTICE\n\n${AI_EXPORT_DISCLAIMER}`,
    ].filter(Boolean);
    return new Blob([sections.join('\n\n---\n\n')], {
      type: 'text/markdown;charset=utf-8',
    });
  }

  private countWords(text: string): number {
    return text
      .trim()
      .split(/\s+/)
      .filter((word) => word.length > 0).length;
  }

  public validateWordLimits(
    data: AbstractData,
    conference: Conference
  ): {
    valid: boolean;
    errors: string[];
  } {
    const template = this.getTemplate(conference);
    const errors: string[] = [];

    const impactWords = this.countWords(data.impact);
    const synopsisWords = this.countWords(data.synopsis);

    if (impactWords > template.wordLimits.impact) {
      errors.push(
        `Impact section exceeds word limit: ${impactWords}/${template.wordLimits.impact} words`
      );
    }

    if (synopsisWords > template.wordLimits.synopsis) {
      errors.push(
        `Synopsis section exceeds word limit: ${synopsisWords}/${template.wordLimits.synopsis} words`
      );
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

export default new ExportService();
