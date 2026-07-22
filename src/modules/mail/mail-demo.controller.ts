import { Body, Controller, Post } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { EmailTestDto } from './dto';
import { MailService } from './mail.service';

@ApiTags('demo-email')
@Controller('api/v1/demo/email-test')
export class MailDemoController {
  constructor(private readonly mailService: MailService) {}

  @Post()
  @ApiOperation({ summary: 'Send a test email via ZeptoMail' })
  @ApiOkResponse({ description: 'Test email accepted by ZeptoMail' })
  sendTestEmail(@Body() dto: EmailTestDto) {
    return this.mailService.send({
      to: [{ address: dto.to, name: dto.toName }],
      subject: dto.subject,
      htmlbody: dto.htmlbody,
    });
  }
}
