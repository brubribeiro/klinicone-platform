import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import { AssistantService } from './assistant.service';
import { AskAssistantDto } from './dto/ask-assistant.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';

/** Assistente de ajuda: responde só com trechos da documentação versionada, sem dados da clínica. */
@UseGuards(JwtAuthGuard)
@Controller('assistant')
export class AssistantController {
  constructor(private readonly service: AssistantService) {}

  @Post('ask')
  @HttpCode(200)
  @Throttle({ default: { ttl: 60000, limit: 20 } })
  ask(@Body() dto: AskAssistantDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.ask(dto.question, AssistantService.audienceFor(user));
  }
}
