import { parsePdf, PdfParseError } from './file-process/pdf';
import { parseDocx, DocxParseError } from './file-process/docx';

export interface FileProcessor {
    supportedTypes: string[];
    parse(file: File): Promise<string>;
    validate(file: File): boolean;
}

export interface FileProcessingOptions {
    maxFileSize?: number; // in bytes, default 10MB
    allowedTypes?: string[];
}

export interface FileProcessingResult {
    success: boolean;
    content?: string;
    error?: FileProcessingError;
    warnings?: string[];
}

export interface FileProcessingError extends Error {
    code: 'UNSUPPORTED_TYPE' | 'FILE_TOO_LARGE' | 'INVALID_FILE' | 'PARSE_ERROR';
    originalError?: Error;
}

class PDFProcessor implements FileProcessor {
    supportedTypes = ['application/pdf', '.pdf'];

    validate(file: File): boolean {
        return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    }

    async parse(file: File): Promise<string> {
        return await parsePdf(file);
    }
}

class DOCXProcessor implements FileProcessor {
    supportedTypes = [
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        '.docx'
    ];

    validate(file: File): boolean {
        return (
            file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
            file.name.toLowerCase().endsWith('.docx')
        );
    }

    async parse(file: File): Promise<string> {
        return await parseDocx(file);
    }
}

export class FileProcessingService {
    private processors: Map<string, FileProcessor> = new Map();
    private options: Required<FileProcessingOptions>;

    constructor(options: FileProcessingOptions = {}) {
        this.options = {
            maxFileSize: options.maxFileSize || 10 * 1024 * 1024, // 10MB default
            allowedTypes: options.allowedTypes || ['pdf', 'docx']
        };

        // Register default processors
        this.registerProcessor('pdf', new PDFProcessor());
        this.registerProcessor('docx', new DOCXProcessor());
    }

    registerProcessor(type: string, processor: FileProcessor): void {
        this.processors.set(type.toLowerCase(), processor);
    }

    getSupportedTypes(): string[] {
        const types: string[] = [];
        this.processors.forEach((processor) => {
            types.push(...processor.supportedTypes);
        });
        return types;
    }

    private getFileType(file: File): string | null {
        // Check by MIME type first
        if (file.type === 'application/pdf') return 'pdf';
        if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            return 'docx';
        }

        // Fallback to file extension
        const extension = file.name.toLowerCase().split('.').pop();
        if (extension === 'pdf') return 'pdf';
        if (extension === 'docx') return 'docx';

        return null;
    }

    private validateFile(file: File): FileProcessingError | null {
        // Check file size
        if (file.size > this.options.maxFileSize) {
            const error = new Error(
                `File size (${Math.round(file.size / 1024 / 1024)}MB) exceeds maximum allowed size (${Math.round(this.options.maxFileSize / 1024 / 1024)}MB)`
            ) as FileProcessingError;
            error.code = 'FILE_TOO_LARGE';
            return error;
        }

        // Check if file type is supported
        const fileType = this.getFileType(file);
        if (!fileType || !this.processors.has(fileType)) {
            const error = new Error(
                `Unsupported file type. Supported formats: ${this.options.allowedTypes.join(', ')}`
            ) as FileProcessingError;
            error.code = 'UNSUPPORTED_TYPE';
            return error;
        }

        // Check if file is valid (not empty, has content)
        if (file.size === 0) {
            const error = new Error('File is empty') as FileProcessingError;
            error.code = 'INVALID_FILE';
            return error;
        }

        return null;
    }

    async processFile(file: File): Promise<FileProcessingResult> {
        try {
            // Validate file
            const validationError = this.validateFile(file);
            if (validationError) {
                return {
                    success: false,
                    error: validationError
                };
            }

            // Get appropriate processor
            const fileType = this.getFileType(file)!;
            const processor = this.processors.get(fileType)!;

            // Additional processor-specific validation
            if (!processor.validate(file)) {
                const error = new Error(
                    `File validation failed for ${fileType.toUpperCase()} processor`
                ) as FileProcessingError;
                error.code = 'INVALID_FILE';
                return {
                    success: false,
                    error
                };
            }

            // Process the file with retry mechanism
            const content = await this.processWithRetry(processor, file, fileType);

            // Validate extracted content
            if (!content || content.trim().length === 0) {
                const error = new Error(
                    'No text content could be extracted from the file'
                ) as FileProcessingError;
                error.code = 'PARSE_ERROR';
                return {
                    success: false,
                    error
                };
            }

            return {
                success: true,
                content: content.trim()
            };

        } catch (error) {
            console.error('File processing error:', error);

            let processingError: FileProcessingError;

            if (error instanceof Error && 'code' in error) {
                // Handle typed errors from processors
                processingError = error as FileProcessingError;
            } else {
                // Handle unexpected errors
                processingError = new Error(
                    error instanceof Error ? error.message : 'Unknown error occurred during file processing'
                ) as FileProcessingError;
                processingError.code = 'PARSE_ERROR';
                processingError.originalError = error instanceof Error ? error : undefined;
            }

            return {
                success: false,
                error: processingError
            };
        }
    }

    private async processWithRetry(processor: FileProcessor, file: File, fileType: string): Promise<string> {
        const maxAttempts = 3;
        let lastError: Error;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                return await processor.parse(file);
            } catch (error) {
                lastError = error as Error;
                
                // Don't retry for validation errors or unsupported files
                if (error instanceof Error && 
                    (error.message.includes('validation') || 
                     error.message.includes('unsupported') ||
                     error.message.includes('corrupted'))) {
                    throw error;
                }

                if (attempt < maxAttempts) {
                    const delay = Math.pow(2, attempt - 1) * 1000; // Exponential backoff
                    console.warn(`File processing attempt ${attempt} failed for ${fileType}, retrying in ${delay}ms:`, error);
                    await new Promise(resolve => setTimeout(resolve, delay));
                } else {
                    console.error(`File processing failed after ${maxAttempts} attempts for ${fileType}:`, error);
                }
            }
        }

        throw lastError!;
    }

    // Utility method to check if a file type is supported
    isFileTypeSupported(file: File): boolean {
        const fileType = this.getFileType(file);
        return fileType !== null && this.processors.has(fileType);
    }

    // Get human-readable error message
    getErrorMessage(error: FileProcessingError): string {
        switch (error.code) {
            case 'UNSUPPORTED_TYPE':
                return `This file type is not supported. Please upload a PDF or DOCX file.`;
            case 'FILE_TOO_LARGE':
                return `File is too large. Maximum size allowed is ${Math.round(this.options.maxFileSize / 1024 / 1024)}MB.`;
            case 'INVALID_FILE':
                return `The file appears to be invalid or corrupted. Please try a different file.`;
            case 'PARSE_ERROR':
                return `Unable to extract text from this file. ${error.message}`;
            default:
                return `An error occurred while processing the file: ${error.message}`;
        }
    }
}

// Export a default instance
export const fileProcessingService = new FileProcessingService();

// Types are already exported above with their interface declarations