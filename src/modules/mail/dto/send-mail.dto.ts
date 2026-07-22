import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class MailAddressDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  address!: string;

  @ApiPropertyOptional({ example: 'Jane Doe' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  name?: string;
}

/** Reusable payload for sending mail anywhere in the backend. */
export class SendMailDto {
  @ApiProperty({
    type: [MailAddressDto],
    example: [{ address: 'user@example.com', name: 'Jane' }],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => MailAddressDto)
  to!: MailAddressDto[];

  @ApiProperty({ example: 'Welcome to Abouttme' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(998)
  subject!: string;

  @ApiPropertyOptional({
    example: '<div><b>Hello</b></div>',
    description: 'HTML body (at least one of htmlbody / textbody required)',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  htmlbody?: string;

  @ApiPropertyOptional({
    example: 'Hello',
    description: 'Plain-text body (at least one of htmlbody / textbody required)',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  textbody?: string;

  @ApiPropertyOptional({ type: MailAddressDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => MailAddressDto)
  from?: MailAddressDto;

  @ApiPropertyOptional({ type: [MailAddressDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MailAddressDto)
  cc?: MailAddressDto[];

  @ApiPropertyOptional({ type: [MailAddressDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MailAddressDto)
  bcc?: MailAddressDto[];

  @ApiPropertyOptional({ type: [MailAddressDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MailAddressDto)
  replyTo?: MailAddressDto[];
}

/** Demo email-test request — simplified form fields. */
export class EmailTestDto {
  @ApiProperty({ example: 'guts.nativedeveloper@gmail.com' })
  @IsEmail()
  to!: string;

  @ApiPropertyOptional({ example: 'Guts' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  toName?: string;

  @ApiProperty({ example: 'Test Email' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(998)
  subject!: string;

  @ApiProperty({
    example: '<div><b>Test email sent successfully.</b></div>',
  })
  @IsString()
  @IsNotEmpty()
  htmlbody!: string;
}
