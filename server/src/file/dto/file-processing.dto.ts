import { IsString, IsOptional, IsEnum, IsNumber, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * File Processing Options DTO
 * Validates file processing configuration from frontend
 */
export class FileProcessingOptionsDto {
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  @Max(50)
  maxFileSize?: number; // in MB, default 10MB

  @IsOptional()
  @IsEnum(['pdf', 'docx'], { message: 'Allowed types: pdf, docx' })
  allowedTypes?: string[];
}

/**
 * File Processing Request DTO
 * Expects base64 encoded file content
 */
export class ProcessFileDto {
  @IsString()
  fileName: string;

  @IsString()
  mimeType: string;

  @IsString()
  content: string; // base64 encoded file content

  @IsOptional()
  @IsString()
  fileType?: string; // 'pdf' or 'docx' override
}

/**
 * File Processing Response DTO
 * Returns extracted text content
 */
export interface FileProcessingResponseDto {
  success: boolean;
  content?: string;
  error?: {
    code: string;
    message: string;
  };
  warnings?: string[];
}
