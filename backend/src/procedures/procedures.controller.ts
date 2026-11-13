import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';

import { ProceduresService } from './procedures.service';
import { CreateProcedureDto } from './dto/create-procedure.dto';
import { UpdateProcedureDto } from './dto/update-procedure.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { FeatureGuard } from '../common/guards/feature.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { RequireFeature } from '../common/decorators/require-feature.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { parseUnlinkFlag } from '../common/deletion/deletion-dependencies';

@RequireFeature('procedures')
@UseGuards(JwtAuthGuard, FeatureGuard, PermissionsGuard)
@Controller('procedures')
export class ProceduresController {
  constructor(private readonly procedures: ProceduresService) {}

  @RequirePermissions('procedures:view')
  @Get()
  list() {
    return this.procedures.list();
  }

  @RequirePermissions('procedures:view')
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.procedures.findOne(id);
  }

  @RequirePermissions('procedures:create')
  @Post()
  create(@Body() dto: CreateProcedureDto, @CurrentUser() user: AuthenticatedUser) {
    return this.procedures.create(dto, user);
  }

  @RequirePermissions('procedures:edit')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateProcedureDto, @CurrentUser() user: AuthenticatedUser) {
    return this.procedures.update(id, dto, user);
  }

  @RequirePermissions('procedures:delete')
  @Delete(':id')
  remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query('unlink') unlink?: string,
  ) {
    return this.procedures.remove(id, user, parseUnlinkFlag(unlink));
  }
}
