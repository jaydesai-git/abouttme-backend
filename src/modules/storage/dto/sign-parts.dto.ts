import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsPositive,
  IsString,
  Max,
} from 'class-validator';

export class SignPartsDto {
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

  @ApiProperty({
    type: [Number],
    example: [1, 2, 3],
    description: '1-based multipart part numbers to sign',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsInt({ each: true })
  @IsPositive({ each: true })
  @Max(10_000, { each: true })
  partNumbers!: number[];
}
