import { PDFParse } from 'pdf-parse';
import * as pdfjsLib from 'pdfjs-dist/build/pdf';
import workerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url';
(pdfjsLib as any).GlobalWorkerOptions.workerSrc = workerUrl;

/**
 * Custom error class for PDF parsing failures
 */
export class PdfParseError extends Error {
  code: 'PDF_CORRUPTED' | 'PDF_ENCRYPTED' | 'PDF_INVALID' | 'PDF_NO_TEXT' | 'PDF_PARSE_FAILED';
  originalError?: Error;

  constructor(
    message: string,
    code: 'PDF_CORRUPTED' | 'PDF_ENCRYPTED' | 'PDF_INVALID' | 'PDF_NO_TEXT' | 'PDF_PARSE_FAILED',
    originalError?: Error
  ) {
    super(message);
    this.name = 'PdfParseError';
    this.code = code;
    this.originalError = originalError;

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, PdfParseError);
    }
  }
}

/**
 * Parse PDF file and extract text content
 * @param file - The PDF file to parse
 * @returns Extracted text content from the PDF
 * @throws {PdfParseError} If parsing fails or file is invalid
 */
export async function parsePdf(file: File): Promise<string> {
  try {
    // Validate file type
    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      throw new PdfParseError('Invalid file type. Expected PDF file.', 'PDF_INVALID');
    }

    // Convert File to ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();

    // Parse PDF using pdfjs-dist directly (reliable worker configuration)
    try {
      const loadingTask = (pdfjsLib as any).getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;

      let combinedText = '';
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str ?? item.text ?? '')
          .join(' ');
        combinedText += pageText + '\n\n';
      }

      const cleanedText = cleanPdfText(combinedText);
      if (!cleanedText || cleanedText.length === 0) {
        throw new PdfParseError(
          'No text content could be extracted from the PDF. The file may contain only images or be empty.',
          'PDF_NO_TEXT'
        );
      }

      return cleanedText;
    } catch (error) {
      const msg = error instanceof Error ? error.message.toLowerCase() : '';
      if (msg.includes('encrypt') || msg.includes('password')) {
        throw new PdfParseError(
          'This PDF is encrypted or password-protected. Please provide an unencrypted version.',
          'PDF_ENCRYPTED',
          error instanceof Error ? error : undefined
        );
      }
      if (msg.includes('corrupt') || msg.includes('invalid pdf')) {
        throw new PdfParseError(
          'The PDF file appears to be corrupted or invalid. Please try a different file.',
          'PDF_CORRUPTED',
          error instanceof Error ? error : undefined
        );
      }
      // Generic parse error
      throw new PdfParseError(
        `Failed to parse PDF: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'PDF_PARSE_FAILED',
        error instanceof Error ? error : undefined
      );
    }
  } catch (error) {
    if (error instanceof PdfParseError) {
      throw error;
    }
    throw new PdfParseError(
      `Unexpected error while parsing PDF: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'PDF_PARSE_FAILED',
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Clean and normalize extracted PDF text
 * @param text - Raw text extracted from PDF
 * @returns Cleaned text
 */
function cleanPdfText(text: string): string {
  return (
    text
      // Normalize line breaks
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      // Remove excessive whitespace
      .replace(/[ \t]+/g, ' ')
      // Remove excessive line breaks (more than 2 consecutive)
      .replace(/\n{3,}/g, '\n\n')
      // Trim each line
      .split('\n')
      .map((line) => line.trim())
      .join('\n')
      // Final trim
      .trim()
  );
}
