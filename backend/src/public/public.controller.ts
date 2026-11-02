import { Controller, Get } from '@nestjs/common';

import { PublicService } from './public.service';

/** Rotas abertas da landing de divulgação (sem JwtAuthGuard). */
@Controller('public')
export class PublicController {
  constructor(private readonly publicService: PublicService) {}

  @Get('plans')
  listPlans() {
    return this.publicService.listPlans();
  }
}
