import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  MaxLength,
} from 'class-validator';

export const STORAGE_CONTEXTS = [
  'profile',
  'bio',
  'qr',
  'email-signature',
  'cv',
  'meeting-banner',
  'misc',
] as const;

export type StorageContext = (typeof STORAGE_CONTEXTS)[number];

/** Max upload size: 20MB */
export const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;

export class InitMultipartDto {
  @ApiProperty({ example: 'avatar.png' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  fileName!: string;

  @ApiProperty({ example: 'image/png' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  fileType!: string;

  @ApiProperty({
    example: 1_048_576,
    description: 'File size in bytes (max 20MB)',
  })
  @IsInt()
  @IsPositive()
  @Max(MAX_FILE_SIZE_BYTES)
  fileSize!: number;

  @ApiProperty({
    enum: STORAGE_CONTEXTS,
    example: 'profile',
  })
  @IsIn(STORAGE_CONTEXTS)
  context!: StorageContext;

  @ApiPropertyOptional({
    example: 'prj_abc123',
    description: 'Optional project scope for non-profile contexts',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  projectId?: string;
}
