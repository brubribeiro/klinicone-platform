import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, type AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { SuperAdminGuard } from '../tenancy/super-admin.guard';
import { AdminService, type TenantStatusFilter } from './admin.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { SuspendTenantDto, UpdateTenantDto } from './dto/update-tenant.dto';
import {
  readAccessTokenCookie,
  setAccessTokenCookie,
  setAdminTokenCookie,
} from '../auth/auth-cookies';

/** Painel administrativo da plataforma: só o super-admin (dono do sistema). */
@UseGuards(JwtAuthGuard, SuperAdminGuard)
@Controller('admin')
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly config: ConfigService,
  ) {}

  @Get('tenants')
  listTenants(@Query('search') search?: string, @Query('status') status?: string) {
    if (status && status !== 'active' && status !== 'suspended') {
      throw new BadRequestException('Status inválido (use active ou suspended).');
    }
    return this.admin.listTenants({ search, status: status as TenantStatusFilter | undefined });
  }

  @Post('tenants')
  createTenant(@Body() dto: CreateTenantDto, @CurrentUser() user: AuthenticatedUser) {
    return this.admin.createTenant(dto, user);
  }

  @Get('tenants/:id')
  getTenant(@Param('id', ParseUUIDPipe) id: string) {
    return this.admin.getTenant(id);
  }

  @Patch('tenants/:id')
  updateTenant(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTenantDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.admin.updateTenant(id, dto, user);
  }

  @Post('tenants/:id/suspend')
  suspendTenant(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SuspendTenantDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.admin.suspendTenant(id, dto.reason, user);
  }

  @Post('tenants/:id/reactivate')
  reactivateTenant(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.admin.reactivateTenant(id, user);
  }

  /** "Entrar como" a clínica: devolve um token do super-admin agindo como administrador dela. */
  @Post('tenants/:id/enter')
  async enterTenant(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.admin.enterTenant(id, user);
    const current = readAccessTokenCookie(req);
    if (current) setAdminTokenCookie(res, current, this.config);
    setAccessTokenCookie(res, result.access_token, this.config);
    return result;
  }

  @Get('audit')
  listAudit(
    @Query('tenantId') tenantId?: string,
    @Query('action') action?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.admin.listAudit({
      tenantId: tenantId || undefined,
      action: action || undefined,
      page: page ? Number(page) || 1 : undefined,
      limit: limit ? Number(limit) || 50 : undefined,
    });
  }
}
