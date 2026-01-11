import { Injectable, Logger } from '@nestjs/common';
import * as pdfParse from 'pdf-parse';
import * as mammoth from 'mammoth';

export interface FileProcessingResult {
  success: boolean;
  content?: string;
  error?: {
    code: string;
    message: string;
  };
  warnings?: string[];
}

/**
 * File Processing Service
 * Node.js-based PDF and DOCX text extraction
 * Uses Buffer instead of browser File API
 */
@Injectable()
export class FileService {
  private readonly logger = new Logger(FileService.name);

  /**
   * Process uploaded file and extract text content
   * @param buffer - Node.js Buffer containing file data
   * @param fileName - Original filename
   * @param mimeType - MIME type of the file
   * @returns Extracted text content or error
   */
  async processFile(
    buffer: Buffer,
    fileName: string,
    mimeType: string
  ): Promise<FileProcessingResult> {
    try {
      // Validate file type
      const fileType = this.detectFileType(fileName, mimeType);
      if (!fileType) {
        return {
          success: false,
          error: {
            code: 'UNSUPPORTED_TYPE',
            message: 'Unsupported file type. Please upload a PDF or DOCX file.',
          },
        };
      }

      // Validate file size (max 10MB)
      const maxSize = 10 * 1024 * 1024;
      if (buffer.length > maxSize) {
        return {
          success: false,
          error: {
            code: 'FILE_TOO_LARGE',
            message: `File is too large. Maximum size allowed is ${Math.round(maxSize / 1024 / 1024)}MB.`,
          },
        };
      }

      // Validate file is not empty
      if (buffer.length === 0) {
        return {
          success: false,
          error: {
            code: 'INVALID_FILE',
            message: 'The file appears to be empty.',
          },
        };
      }

      // Process based on file type
      let content: string;
      if (fileType === 'pdf') {
        content = await this.parsePdf(buffer);
      } else {
        content = await this.parseDocx(buffer);
      }

      // Validate extracted content
      if (!content || content.trim().length === 0) {
        return {
          success: false,
          error: {
            code: 'PARSE_ERROR',
            message: 'No text content could be extracted from the file.',
          },
        };
      }

      return {
        success: true,
        content: content.trim(),
      };
    } catch (error) {
      this.logger.error(`File processing error for ${fileName}:`, error);
      return {
        success: false,
        error: {
          code: 'PARSE_ERROR',
          message:
            error instanceof Error
              ? error.message
              : 'Unknown error occurred during file processing',
        },
      };
    }
  }

  /**
   * Detect file type from filename and MIME type
   */
  private detectFileType(fileName: string, mimeType: string): 'pdf' | 'docx' | null {
    const lowerName = fileName.toLowerCase();

    // Check by MIME type first
    if (mimeType === 'application/pdf') return 'pdf';
    if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
      return 'docx';

    // Fallback to file extension
    if (lowerName.endsWith('.pdf')) return 'pdf';
    if (lowerName.endsWith('.docx')) return 'docx';

    return null;
  }

  /**
   * Parse PDF file and extract text content using pdf-parse
   */
  private async parsePdf(buffer: Buffer): Promise<string> {
    try {
      const data = await (pdfParse as any)(buffer);

      if (!data || !data.text) {
        throw new PdfParseError('No text content could be extracted from the PDF.', 'PDF_NO_TEXT');
      }

      return this.cleanPdfText(data.text);
    } catch (error) {
      if (error instanceof PdfParseError) {
        throw error;
      }

      const msg = error instanceof Error ? error.message.toLowerCase() : '';
      if (msg.includes('encrypt') || msg.includes('password') || msg.includes('protected')) {
        throw new PdfParseError(
          'This PDF is encrypted or password-protected. Please provide an unencrypted version.',
          'PDF_ENCRYPTED',
          error instanceof Error ? error : undefined
        );
      }
      if (msg.includes('corrupt') || msg.includes('invalid') || msg.includes('parse')) {
        throw new PdfParseError(
          'The PDF file appears to be corrupted or invalid.',
          'PDF_CORRUPTED',
          error instanceof Error ? error : undefined
        );
      }

      throw new PdfParseError(
        `Failed to parse PDF: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'PDF_PARSE_FAILED',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Parse DOCX file and extract text content using mammoth
   */
  private async parseDocx(buffer: Buffer): Promise<string> {
    try {
      const result = await mammoth.extractRawText({ buffer });

      if (!result || !result.value) {
        throw new DocxParseError(
          'No text content could be extracted from the DOCX.',
          'DOCX_NO_TEXT'
        );
      }

      // Check for warnings
      const warnings = result.messages?.filter((msg) => msg.type === 'error');
      if (warnings && warnings.length > 0) {
        this.logger.warn('DOCX parsing warnings:', warnings);
      }

      return this.cleanDocxText(result.value);
    } catch (error) {
      if (error instanceof DocxParseError) {
        throw error;
      }

      const msg = error instanceof Error ? error.message.toLowerCase() : '';
      if (
        msg.includes('corrupt') ||
        msg.includes('invalid') ||
        msg.includes('not a valid') ||
        msg.includes('zip')
      ) {
        throw new DocxParseError(
          'The DOCX file appears to be corrupted or invalid.',
          'DOCX_CORRUPTED',
          error instanceof Error ? error : undefined
        );
      }
      if (msg.includes('.doc')) {
        throw new DocxParseError(
          'Old .doc format is not supported. Please save the file as .docx (Word 2007 or later).',
          'DOCX_UNSUPPORTED'
        );
      }

      throw new DocxParseError(
        `Failed to parse DOCX: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'DOCX_PARSE_FAILED',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Clean and normalize extracted PDF text
   */
  private cleanPdfText(text: string): string {
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

  /**
   * Clean and normalize extracted DOCX text
   */
  private cleanDocxText(text: string): string {
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
        .filter((line) => line.length > 0) // Remove empty lines
        .join('\n')
        // Final trim
        .trim()
    );
  }
}

/**
 * Custom error class for PDF parsing failures
 */
class PdfParseError extends Error {
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

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, PdfParseError);
    }
  }
}

/**
 * Custom error class for DOCX parsing failures
 */
class DocxParseError extends Error {
  code:
    | 'DOCX_CORRUPTED'
    | 'DOCX_INVALID'
    | 'DOCX_NO_TEXT'
    | 'DOCX_PARSE_FAILED'
    | 'DOCX_UNSUPPORTED';
  originalError?: Error;

  constructor(
    message: string,
    code:
      | 'DOCX_CORRUPTED'
      | 'DOCX_INVALID'
      | 'DOCX_NO_TEXT'
      | 'DOCX_PARSE_FAILED'
      | 'DOCX_UNSUPPORTED',
    originalError?: Error
  ) {
    super(message);
    this.name = 'DocxParseError';
    this.code = code;
    this.originalError = originalError;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, DocxParseError);
    }
  }
}
