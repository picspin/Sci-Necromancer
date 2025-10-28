import { PDFParse } from 'pdf-parse';

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
            throw new PdfParseError(
                'Invalid file type. Expected PDF file.',
                'PDF_INVALID'
            );
        }

        // Convert File to ArrayBuffer
        const arrayBuffer = await file.arrayBuffer();

        // Parse PDF using PDFParse class
        let pdfData;
        try {
            const parser = new PDFParse({ data: new Uint8Array(arrayBuffer) });
            pdfData = await parser.getText();
        } catch (error) {
            // Check for specific error types
            const errorMessage = error instanceof Error ? error.message.toLowerCase() : '';
            
            if (errorMessage.includes('encrypt') || errorMessage.includes('password')) {
                throw new PdfParseError(
                    'This PDF is encrypted or password-protected. Please provide an unencrypted version.',
                    'PDF_ENCRYPTED',
                    error instanceof Error ? error : undefined
                );
            }
            
            if (errorMessage.includes('corrupt') || errorMessage.includes('invalid pdf')) {
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

        // Extract text content
        const text = pdfData.text?.trim();

        if (!text || text.length === 0) {
            throw new PdfParseError(
                'No text content could be extracted from the PDF. The file may contain only images or be empty.',
                'PDF_NO_TEXT'
            );
        }

        // Clean up the extracted text
        const cleanedText = cleanPdfText(text);

        return cleanedText;

    } catch (error) {
        // Re-throw PdfParseError as-is
        if (error instanceof PdfParseError) {
            throw error;
        }

        // Wrap unexpected errors
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
    return text
        // Normalize line breaks
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        // Remove excessive whitespace
        .replace(/[ \t]+/g, ' ')
        // Remove excessive line breaks (more than 2 consecutive)
        .replace(/\n{3,}/g, '\n\n')
        // Trim each line
        .split('\n')
        .map(line => line.trim())
        .join('\n')
        // Final trim
        .trim();
}
