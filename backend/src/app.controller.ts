import { Controller, Get } from '@nestjs/common';

import { getAppEnv } from './common/app-env';
import { getAppVersion } from './common/version';

@Controller()
export class AppController {
  @Get('health')
  health() {
    return {
      status: 'ok',
      version: getAppVersion(),
      env: getAppEnv(),
    };
  }
}
