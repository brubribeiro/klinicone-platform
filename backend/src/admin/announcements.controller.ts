import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, type AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { SuperAdminGuard } from '../tenancy/super-admin.guard';
import { AnnouncementsService } from './announcements.service';
import {
  AnnouncementQueryDto,
  CreateAnnouncementDto,
  ScheduleAnnouncementDto,
  UpdateAnnouncementDto,
} from './dto/announcement.dto';

/** Avisos de novidades/correções para as clínicas: só o super-admin. */
@UseGuards(JwtAuthGuard, SuperAdminGuard)
@Controller('admin/announcements')
export class AnnouncementsController {
  constructor(private readonly announcements: AnnouncementsService) {}

  @Get()
  list(@Query() query: AnnouncementQueryDto) {
    return this.announcements.list(query);
  }

  @Get('audience')
  audience() {
    return this.announcements.audience();
  }

  @Post()
  create(@Body() dto: CreateAnnouncementDto, @CurrentUser() user: AuthenticatedUser) {
    return this.announcements.create(dto, user);
  }

  /** Chamado pelo botão "Gerar do release" (o boot da API já faz isso uma vez por versão). */
  @Post('draft-from-release')
  draftFromRelease(@CurrentUser() user: AuthenticatedUser) {
    return this.announcements.draftFromRelease(user);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.announcements.get(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAnnouncementDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.announcements.update(id, dto, user);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.announcements.remove(id, user);
  }

  @Post(':id/send')
  send(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.announcements.send(id, user);
  }

  @Post(':id/schedule')
  schedule(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ScheduleAnnouncementDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.announcements.schedule(id, new Date(dto.scheduledAt), user);
  }

  @Post(':id/unschedule')
  unschedule(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.announcements.unschedule(id, user);
  }
}
