import { Controller, Post, Body, HttpCode, HttpStatus, BadRequestException } from '@nestjs/common';
import { FileService, FileProcessingResult } from './file.service';
import { ProcessFileDto } from './dto/file-processing.dto';

/**
 * File Processing Controller
 * REST API endpoints for PDF and DOCX text extraction
 * Designed for serverless deployment (AWS Lambda / Vercel)
 */
@Controller('api/file')
export class FileController {
  constructor(private readonly fileService: FileService) {}

  /**
   * Process uploaded file and extract text content
   * POST /api/file/process
   *
   * @param processFileDto - File data with base64 encoded content
   * @returns Extracted text content or error
   */
  @Post('process')
  @HttpCode(HttpStatus.OK)
  async processFile(@Body() processFileDto: ProcessFileDto): Promise<FileProcessingResult> {
    // Validate required fields
    if (!processFileDto.fileName || !processFileDto.mimeType || !processFileDto.content) {
      throw new BadRequestException('Missing required file data: fileName, mimeType, or content');
    }

    // Convert base64 to Buffer
    let buffer: Buffer;
    try {
      buffer = Buffer.from(processFileDto.content, 'base64');
    } catch {
      throw new BadRequestException('Invalid base64 encoded file content');
    }

    // Process the file
    return this.fileService.processFile(buffer, processFileDto.fileName, processFileDto.mimeType);
  }

  /**
   * Health check endpoint
   * GET /api/file/health
   */
  @Post('health')
  @HttpCode(HttpStatus.OK)
  healthCheck(): { status: string; timestamp: string } {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
