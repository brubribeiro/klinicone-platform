import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Put, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, type AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { SuperAdminGuard } from '../tenancy/super-admin.guard';
import {
  CreateMeasurementTypeDto,
  ReorderMeasurementTypesDto,
  UpdateMeasurementTypeDto,
} from './dto/measurement-type.dto';
import { MeasurementTypesService } from './measurement-types.service';

/** CRUD dos tipos de medida corporal: só o super-admin. */
@UseGuards(JwtAuthGuard, SuperAdminGuard)
@Controller('admin/measurement-types')
export class MeasurementTypesController {
  constructor(private readonly types: MeasurementTypesService) {}

  @Get()
  list() {
    return this.types.listForAdmin();
  }

  @Post()
  create(@Body() dto: CreateMeasurementTypeDto, @CurrentUser() user: AuthenticatedUser) {
    return this.types.create(dto, user);
  }

  @Put('order')
  reorder(@Body() dto: ReorderMeasurementTypesDto, @CurrentUser() user: AuthenticatedUser) {
    return this.types.reorder(dto.ids, user);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMeasurementTypeDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.types.update(id, dto, user);
  }

  @Post(':id/activate')
  activate(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.types.setActive(id, true, user);
  }

  @Post(':id/deactivate')
  deactivate(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.types.setActive(id, false, user);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.types.remove(id, user);
  }
}
