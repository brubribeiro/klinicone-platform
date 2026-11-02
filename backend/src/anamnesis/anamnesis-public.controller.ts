import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import { AnamnesisService } from './anamnesis.service';
import { SubmitPublicAnamnesisDto } from './dto/anamnesis.dto';

/** Formulário que a paciente abre pelo link (sem login). Só mostra o primeiro nome dela. */
@Throttle({ default: { ttl: 60000, limit: 10 } })
@Controller('public/anamnesis')
export class AnamnesisPublicController {
  constructor(private readonly service: AnamnesisService) {}

  @Get(':token')
  getForm(@Param('token') token: string) {
    return this.service.getPublicForm(token);
  }

  @Post(':token')
  submit(@Param('token') token: string, @Body() dto: SubmitPublicAnamnesisDto) {
    return this.service.submitPublic(token, dto.answers);
  }
}
