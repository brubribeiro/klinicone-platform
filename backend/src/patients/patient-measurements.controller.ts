import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';

import { PatientMeasurementsService } from './patient-measurements.service';
import { CreatePatientMeasurementDto, UpdatePatientMeasurementDto } from './dto/patient-measurement.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { FeatureGuard } from '../common/guards/feature.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { RequireFeature } from '../common/decorators/require-feature.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';

/** Histórico de medidas corporais do paciente. */
@RequireFeature('patients')
@UseGuards(JwtAuthGuard, FeatureGuard, PermissionsGuard)
@Controller('patients/:id/measurements')
export class PatientMeasurementsController {
  constructor(private readonly measurements: PatientMeasurementsService) {}

  @RequirePermissions('patients:view')
  @Get()
  list(@Param('id', ParseUUIDPipe) id: string) {
    return this.measurements.list(id);
  }

  @RequirePermissions('patients:edit')
  @Post()
  create(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreatePatientMeasurementDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.measurements.create(id, dto, user);
  }

  @RequirePermissions('patients:edit')
  @Patch(':measurementId')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('measurementId', ParseUUIDPipe) measurementId: string,
    @Body() dto: UpdatePatientMeasurementDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.measurements.update(id, measurementId, dto, user);
  }

  @RequirePermissions('patients:edit')
  @Delete(':measurementId')
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('measurementId', ParseUUIDPipe) measurementId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.measurements.remove(id, measurementId, user);
  }
}
