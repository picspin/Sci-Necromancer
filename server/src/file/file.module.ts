import { Module } from '@nestjs/common';
import { FileController } from './file.controller';
import { FileService } from './file.service';

/**
 * File Processing Module
 * Handles PDF and DOCX text extraction for the frontend
 */
@Module({
  controllers: [FileController],
  providers: [FileService],
  exports: [FileService],
})
export class FileModule {}
