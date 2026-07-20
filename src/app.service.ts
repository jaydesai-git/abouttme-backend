import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHealth() {
    return {
      status: 'ok',
      service: 'abouttme-backend',
      timestamp: new Date().toISOString(),
    };
  }
}
