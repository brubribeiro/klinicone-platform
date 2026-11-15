import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';

import { InventoryService } from './inventory.service';
import { CreateInventoryItemDto } from './dto/create-inventory-item.dto';
import { UpdateInventoryItemDto } from './dto/update-inventory-item.dto';
import { CreateMovementDto } from './dto/create-movement.dto';
import { BulkPurchaseDto } from './dto/bulk-purchase.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { FeatureGuard } from '../common/guards/feature.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { RequireFeature } from '../common/decorators/require-feature.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { parseUnlinkFlag } from '../common/deletion/deletion-dependencies';

@RequireFeature('inventory')
@UseGuards(JwtAuthGuard, FeatureGuard, PermissionsGuard)
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @RequirePermissions('inventory:view')
  @Get()
  list() {
    return this.inventory.list();
  }

  @RequirePermissions('inventory:view')
  @Get('low-stock')
  listLowStock() {
    return this.inventory.listLowStock();
  }

  @RequirePermissions('inventory:view')
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.inventory.findOne(id);
  }

  @RequirePermissions('inventory:create')
  @Post()
  create(@Body() dto: CreateInventoryItemDto, @CurrentUser() user: AuthenticatedUser) {
    return this.inventory.create(dto, user);
  }

  @RequirePermissions('inventory:edit')
  @Post('bulk-purchase')
  createBulkPurchase(@Body() dto: BulkPurchaseDto, @CurrentUser() user: AuthenticatedUser) {
    return this.inventory.createBulkPurchase(dto, user);
  }

  @RequirePermissions('inventory:edit')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateInventoryItemDto, @CurrentUser() user: AuthenticatedUser) {
    return this.inventory.update(id, dto, user);
  }

  @RequirePermissions('inventory:delete')
  @Delete(':id')
  remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query('unlink') unlink?: string,
  ) {
    return this.inventory.remove(id, user, parseUnlinkFlag(unlink));
  }

  // Movimentação manual conta como edição do item
  @RequirePermissions('inventory:edit')
  @Post(':id/movements')
  createMovement(@Param('id') id: string, @Body() dto: CreateMovementDto, @CurrentUser() user: AuthenticatedUser) {
    return this.inventory.createMovement(id, dto, user);
  }
}
