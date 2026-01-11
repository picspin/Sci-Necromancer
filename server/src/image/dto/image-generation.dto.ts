import {
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  ValidateNested,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO for Nanobanana image generation request
 */
export class NanobanaImageDto {
  @IsString()
  mimeType: string;

  @IsString()
  data: string;
}

export class GenerateNanobanaDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => NanobanaImageDto)
  image?: NanobanaImageDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => NanobanaImageDto)
  images?: NanobanaImageDto[];

  @IsString()
  prompt: string;

  @IsOptional()
  @IsString()
  model?: string;
}

export class NanobanaResponseDto {
  success: boolean;
  image?: string;
  error?: string;
}
