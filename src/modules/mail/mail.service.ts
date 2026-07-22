import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SendMailClient } from 'zeptomail';
import type { Env } from '../../config/env.schema';
import type { MailAddressDto, SendMailDto } from './dto';

@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  private readonly client: SendMailClient;
  private readonly defaultFrom: { address: string; name: string };

  constructor(private readonly config: ConfigService<Env, true>) {
    const url = this.config.get('ZEPTO_MAIL_URL', { infer: true });
    const token = this.config.get('ZEPTO_MAIL_API_KEY', { infer: true });
    this.defaultFrom = {
      address: this.config.get('ZEPTO_MAIL_FROM', { infer: true }),
      name: this.config.get('ZEPTO_MAIL_FROM_NAME', { infer: true }),
    };
    this.client = new SendMailClient({ url, token });
  }

  onModuleInit() {
    this.logger.log(
      `ZeptoMail client ready (from=${this.defaultFrom.address})`,
    );
  }

  /**
   * Reusable send — inject MailService anywhere and call this.
   */
  async send(dto: SendMailDto) {
    if (!dto.htmlbody && !dto.textbody) {
      throw new BadRequestException(
        'Provide at least one of htmlbody or textbody',
      );
    }

    const from = this.toZeptoAddress(dto.from ?? this.defaultFrom);

    try {
      const response = await this.client.sendMail({
        from,
        to: dto.to.map((recipient) => ({
          email_address: this.toZeptoAddress(recipient),
        })),
        subject: dto.subject,
        ...(dto.htmlbody ? { htmlbody: dto.htmlbody } : {}),
        ...(dto.textbody ? { textbody: dto.textbody } : {}),
        ...(dto.cc?.length
          ? {
              cc: dto.cc.map((recipient) => ({
                email_address: this.toZeptoAddress(recipient),
              })),
            }
          : {}),
        ...(dto.bcc?.length
          ? {
              bcc: dto.bcc.map((recipient) => ({
                email_address: this.toZeptoAddress(recipient),
              })),
            }
          : {}),
        ...(dto.replyTo?.length
          ? { reply_to: dto.replyTo.map((r) => this.toZeptoAddress(r)) }
          : {}),
      });

      this.logger.log(
        `Mail sent to ${dto.to.map((t) => t.address).join(', ')} — ${dto.subject}`,
      );

      return {
        message: 'Email sent successfully',
        provider: response,
      };
    } catch (error) {
      this.logger.error('ZeptoMail send failed', error);
      throw new BadGatewayException(
        error instanceof Error ? error.message : 'Failed to send email',
      );
    }
  }

  private toZeptoAddress(address: MailAddressDto): {
    address: string;
    name: string;
  } {
    return {
      address: address.address,
      name: address.name?.trim() || address.address.split('@')[0] || 'User',
    };
  }
}
