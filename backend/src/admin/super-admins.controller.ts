import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, type AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { SuperAdminGuard } from '../tenancy/super-admin.guard';
import { CreateSuperAdminDto } from './dto/super-admin.dto';
import { SuperAdminsService } from './super-admins.service';

/** Gerenciar super-admins da plataforma: só o próprio super-admin. */
@UseGuards(JwtAuthGuard, SuperAdminGuard)
@Controller('admin/super-admins')
export class SuperAdminsController {
  constructor(private readonly superAdmins: SuperAdminsService) {}

  @Get()
  list() {
    return this.superAdmins.list();
  }

  @Post()
  create(@Body() dto: CreateSuperAdminDto, @CurrentUser() user: AuthenticatedUser) {
    return this.superAdmins.create(dto, user);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.superAdmins.remove(id, user);
  }
}
