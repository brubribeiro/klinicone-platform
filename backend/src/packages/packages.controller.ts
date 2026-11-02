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

import { PackagesService } from './packages.service';
import { CreatePackageDto } from './dto/create-package.dto';
import { UpdatePackageDto } from './dto/update-package.dto';
import {
  CreatePatientPackageDto,
  UpdatePatientPackageDto,
} from './dto/create-patient-package.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { FeatureGuard } from '../common/guards/feature.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { RequireFeature } from '../common/decorators/require-feature.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';

@RequireFeature('packages')
@UseGuards(JwtAuthGuard, FeatureGuard, PermissionsGuard)
@Controller('packages')
export class PackagesController {
  constructor(private readonly packages: PackagesService) {}

  // ─── PatientPackage (venda/vínculo) ───
  // IMPORTANTE: rotas com prefixo fixo devem vir ANTES de `:id` para não serem capturadas

  @RequirePermissions('packages:view')
  @Get('patient-packages/list')
  listPatientPackages(@Query('patientId') patientId?: string) {
    return this.packages.listPatientPackages(patientId);
  }

  @RequirePermissions('packages:view')
  @Get('patient-packages/active/:patientId')
  listActiveForPatient(@Param('patientId') patientId: string) {
    return this.packages.listActiveForPatient(patientId);
  }

  @RequirePermissions('packages:view')
  @Get('patient-packages/:id')
  findPatientPackage(@Param('id') id: string) {
    return this.packages.findPatientPackage(id);
  }

  @RequirePermissions('packages:create')
  @Post('patient-packages')
  createPatientPackage(@Body() dto: CreatePatientPackageDto, @CurrentUser() user: AuthenticatedUser) {
    return this.packages.createPatientPackage(dto, user);
  }

  @RequirePermissions('packages:edit')
  @Patch('patient-packages/:id')
  updatePatientPackage(
    @Param('id') id: string,
    @Body() dto: UpdatePatientPackageDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.packages.updatePatientPackage(id, dto, user);
  }

  // ─── Package (template/catálogo) ───

  @RequirePermissions('packages:view')
  @Get()
  list() {
    return this.packages.list();
  }

  @RequirePermissions('packages:view')
  @Get('stats/summary')
  stats() {
    return this.packages.stats();
  }

  @RequirePermissions('packages:view')
  @Get(':id/sale-quote')
  saleQuote(@Param('id') id: string) {
    return this.packages.saleQuote(id);
  }

  @RequirePermissions('packages:view')
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.packages.findOne(id);
  }

  @RequirePermissions('packages:create')
  @Post()
  create(@Body() dto: CreatePackageDto, @CurrentUser() user: AuthenticatedUser) {
    return this.packages.create(dto, user);
  }

  @RequirePermissions('packages:edit')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePackageDto, @CurrentUser() user: AuthenticatedUser) {
    return this.packages.update(id, dto, user);
  }

  @RequirePermissions('packages:delete')
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.packages.remove(id, user);
  }
}
