import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import {
  EquipmentService,
  CreateEquipmentDto,
  UpdateEquipmentDto,
} from './equipment.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { FeatureGuard } from '../common/guards/feature.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { RequireFeature } from '../common/decorators/require-feature.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { parseUnlinkFlag } from '../common/deletion/deletion-dependencies';

@RequireFeature('equipment')
@UseGuards(JwtAuthGuard, FeatureGuard, PermissionsGuard)
@Controller('equipment')
export class EquipmentController {
  constructor(private readonly equipment: EquipmentService) {}

  @RequirePermissions('equipment:view')
  @Get()
  list() {
    return this.equipment.list();
  }

  @RequirePermissions('equipment:view')
  @Get('due-soon')
  dueSoon(@Query('days') days?: string) {
    return this.equipment.dueSoon(days ? Number(days) : 30);
  }

  @RequirePermissions('equipment:view')
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.equipment.findOne(id);
  }

  @RequirePermissions('equipment:create')
  @Post()
  create(@Body() dto: CreateEquipmentDto, @CurrentUser() user: AuthenticatedUser) {
    return this.equipment.create(dto, user);
  }

  @RequirePermissions('equipment:edit')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateEquipmentDto, @CurrentUser() user: AuthenticatedUser) {
    return this.equipment.update(id, dto, user);
  }

  @RequirePermissions('equipment:edit')
  @Post(':id/maintenance')
  registerMaintenance(@Param('id') id: string) {
    return this.equipment.registerMaintenance(id);
  }

  @RequirePermissions('equipment:delete')
  @Delete(':id')
  remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query('unlink') unlink?: string,
  ) {
    return this.equipment.remove(id, user, parseUnlinkFlag(unlink));
  }

  /** Endpoint para disparar checagem de notificações de manutenção (pode ser chamado via cron). */
  @RequirePermissions('equipment:view')
  @Post('check-maintenance-notifications')
  checkMaintenanceNotifications() {
    return this.equipment.checkMaintenanceNotifications();
  }
}
