import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { AppointmentsService } from './appointments.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { FeatureGuard } from '../common/guards/feature.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { RequireFeature } from '../common/decorators/require-feature.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';

@RequireFeature('appointments')
@UseGuards(JwtAuthGuard, FeatureGuard, PermissionsGuard)
@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly appts: AppointmentsService) {}

  @RequirePermissions('appointments:view')
  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const professionalId = user.restrictToOwnAppointments ? user.id : undefined;
    return this.appts.list(from, to, professionalId);
  }

  @RequirePermissions('appointments:view')
  @Get('pending')
  pending(@CurrentUser() user: AuthenticatedUser) {
    const professionalId = user.restrictToOwnAppointments ? user.id : undefined;
    return this.appts.pending(professionalId);
  }

  @RequirePermissions('appointments:view')
  @Get('recurrence-limit')
  getRecurrenceLimit(
    @Query('patientId') patientId: string,
    @Query('procedureId') procedureId: string,
    @Query('excludeId') excludeId?: string,
  ) {
    return this.appts.getRecurrenceLimit(patientId, procedureId, excludeId);
  }

  @RequirePermissions('appointments:view')
  @Get('promotion-preview')
  promotionPreview(
    @Query('procedureId', ParseUUIDPipe) procedureId: string,
    @Query('date') date: string,
  ) {
    return this.appts.promotionPreview(procedureId, date);
  }

  @RequirePermissions('appointments:view')
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.appts.findOne(id, user);
  }

  @RequirePermissions('appointments:create')
  @Post()
  create(@Body() dto: CreateAppointmentDto, @CurrentUser() user: AuthenticatedUser) {
    return this.appts.create(dto, user);
  }

  @RequirePermissions('appointments:edit')
  @Post('backfill-finance')
  backfillFinance() {
    return this.appts.backfillFinance();
  }

  @RequirePermissions('appointments:edit')
  @Patch(':id/start')
  start(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.appts.start(id, user);
  }

  @RequirePermissions('appointments:edit')
  @Patch(':id/finish')
  finish(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.appts.finish(id, user);
  }

  @RequirePermissions('appointments:edit')
  @Patch(':id/resume')
  resume(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.appts.resume(id, user);
  }

  @RequirePermissions('appointments:edit')
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAppointmentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.appts.update(id, dto, user);
  }

  @RequirePermissions('appointments:delete')
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.appts.remove(id, user);
  }
}
