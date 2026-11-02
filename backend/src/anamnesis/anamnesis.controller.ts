import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';

import { AnamnesisService } from './anamnesis.service';
import {
  CreateAnamnesisLinkDto,
  CreateAnamnesisQuestionDto,
  ListAnamnesisQuestionsQueryDto,
  ReorderAnamnesisQuestionsDto,
  UpdateAnamnesisQuestionDto,
} from './dto/anamnesis.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ClinicAdminGuard } from '../common/guards/clinic-admin.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';

/** Perguntas da anamnese (geral e de pele) da clínica e link para a paciente preencher. */
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('anamnesis')
export class AnamnesisController {
  constructor(private readonly service: AnamnesisService) {}

  /** Todos os formulários leem daqui (inclusive perguntas inativas, para rotular respostas antigas). */
  @Get('questions')
  listQuestions(@Query() query: ListAnamnesisQuestionsQueryDto) {
    return this.service.listQuestions(query.kind);
  }

  @UseGuards(ClinicAdminGuard)
  @Post('questions')
  createQuestion(@Body() dto: CreateAnamnesisQuestionDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.createQuestion(dto, user);
  }

  @UseGuards(ClinicAdminGuard)
  @Patch('questions/reorder')
  reorderQuestions(@Body() dto: ReorderAnamnesisQuestionsDto) {
    return this.service.reorderQuestions(dto);
  }

  @UseGuards(ClinicAdminGuard)
  @Patch('questions/:id')
  updateQuestion(@Param('id') id: string, @Body() dto: UpdateAnamnesisQuestionDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.updateQuestion(id, dto, user);
  }

  @RequirePermissions('patients:edit')
  @Post('links')
  createLink(@Body() dto: CreateAnamnesisLinkDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.createLink(dto.patientId, user);
  }
}
