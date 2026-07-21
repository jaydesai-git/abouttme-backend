import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class DeleteFileDto {
  @ApiProperty({
    example: 'users/usr_999design/profile/uuid.png',
  })
  @IsString()
  @IsNotEmpty()
  storageKey!: string;
}
