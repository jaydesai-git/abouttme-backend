import { Global, Module } from '@nestjs/common';
import { MailDemoController } from './mail-demo.controller';
import { MailService } from './mail.service';

@Global()
@Module({
  controllers: [MailDemoController],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
