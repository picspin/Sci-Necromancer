import * as mammoth from 'mammoth';

/**
 * Custom error class for DOCX parsing failures
 */
export class DocxParseError extends Error {
    code: 'DOCX_CORRUPTED' | 'DOCX_INVALID' | 'DOCX_NO_TEXT' | 'DOCX_PARSE_FAILED' | 'DOCX_UNSUPPORTED';
    originalError?: Error;

    constructor(
        message: string,
        code: 'DOCX_CORRUPTED' | 'DOCX_INVALID' | 'DOCX_NO_TEXT' | 'DOCX_PARSE_FAILED' | 'DOCX_UNSUPPORTED',
        originalError?: Error
    ) {
        super(message);
        this.name = 'DocxParseError';
        this.code = code;
        this.originalError = originalError;
        
        // Maintains proper stack trace for where our error was thrown (only available on V8)
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, DocxParseError);
        }
    }
}

/**
 * Parse DOCX file and extract text content
 * @param file - The DOCX file to parse
 * @returns Extracted text content from the DOCX
 * @throws {DocxParseError} If parsing fails or file is invalid
 */
export async function parseDocx(file: File): Promise<string> {
    try {
        // Validate file type
        const fileName = file.name.toLowerCase();
        const isDocx = fileName.endsWith('.docx') || 
                      file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        
        if (!isDocx) {
            // Check if it's an old .doc format
            if (fileName.endsWith('.doc')) {
                throw new DocxParseError(
                    'Old .doc format is not supported. Please save the file as .docx (Word 2007 or later) and try again.',
                    'DOCX_UNSUPPORTED'
                );
            }
            
            throw new DocxParseError(
                'Invalid file type. Expected DOCX file.',
                'DOCX_INVALID'
            );
        }

        // Convert File to ArrayBuffer
        const arrayBuffer = await file.arrayBuffer();

        // Parse DOCX using mammoth
        let result;
        try {
            result = await mammoth.extractRawText({ arrayBuffer });
        } catch (error) {
            // Check for specific error types
            const errorMessage = error instanceof Error ? error.message.toLowerCase() : '';
            
            if (errorMessage.includes('corrupt') || 
                errorMessage.includes('invalid') || 
                errorMessage.includes('not a valid') ||
                errorMessage.includes('zip')) {
                throw new DocxParseError(
                    'The DOCX file appears to be corrupted or invalid. Please try a different file or re-save the document.',
                    'DOCX_CORRUPTED',
                    error instanceof Error ? error : undefined
                );
            }
            
            // Generic parse error
            throw new DocxParseError(
                `Failed to parse DOCX: ${error instanceof Error ? error.message : 'Unknown error'}`,
                'DOCX_PARSE_FAILED',
                error instanceof Error ? error : undefined
            );
        }

        // Extract text content
        const text = result.value?.trim();

        // Check for warnings from mammoth
        if (result.messages && result.messages.length > 0) {
            const errors = result.messages.filter(msg => msg.type === 'error');
            if (errors.length > 0) {
                console.warn('DOCX parsing warnings:', errors);
            }
        }

        if (!text || text.length === 0) {
            throw new DocxParseError(
                'No text content could be extracted from the DOCX. The file may be empty or contain only images.',
                'DOCX_NO_TEXT'
            );
        }

        // Clean up the extracted text
        const cleanedText = cleanDocxText(text);

        return cleanedText;

    } catch (error) {
        // Re-throw DocxParseError as-is
        if (error instanceof DocxParseError) {
            throw error;
        }

        // Wrap unexpected errors
        throw new DocxParseError(
            `Unexpected error while parsing DOCX: ${error instanceof Error ? error.message : 'Unknown error'}`,
            'DOCX_PARSE_FAILED',
            error instanceof Error ? error : undefined
        );
    }
}

/**
 * Clean and normalize extracted DOCX text
 * @param text - Raw text extracted from DOCX
 * @returns Cleaned text
 */
function cleanDocxText(text: string): string {
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
        .filter(line => line.length > 0) // Remove empty lines
        .join('\n')
        // Final trim
        .trim();
}
