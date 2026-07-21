import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class GetFileUrlDto {
  @ApiProperty({
    example: 'users/usr_999design/profile/uuid.png',
  })
  @IsString()
  @IsNotEmpty()
  storageKey!: string;

  @ApiPropertyOptional({
    enum: ['inline', 'attachment'],
    default: 'inline',
    description: 'inline = view in browser, attachment = force download',
  })
  @IsOptional()
  @IsIn(['inline', 'attachment'])
  disposition?: 'inline' | 'attachment';

  @ApiPropertyOptional({
    example: 'avatar.svg',
    description: 'Optional filename for Content-Disposition',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  fileName?: string;
}
