import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsPositive,
  IsString,
  Max,
  ValidateNested,
} from 'class-validator';

export class CompletedPartDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  @IsPositive()
  @Max(10_000)
  partNumber!: number;

  @ApiProperty({ example: '"abc123etag"' })
  @IsString()
  @IsNotEmpty()
  eTag!: string;
}

export class CompleteMultipartDto {
  @ApiProperty({
    example: 'users/usr_999design/profile/uuid.png',
  })
  @IsString()
  @IsNotEmpty()
  storageKey!: string;

  @ApiProperty({ example: 'upload-id-from-init' })
  @IsString()
  @IsNotEmpty()
  uploadId!: string;

  @ApiProperty({ type: [CompletedPartDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CompletedPartDto)
  parts!: CompletedPartDto[];
}
