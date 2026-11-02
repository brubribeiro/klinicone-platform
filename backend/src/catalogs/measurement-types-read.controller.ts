import { Controller, Get, UseGuards } from '@nestjs/common';

import { MeasurementTypesService } from '../admin/measurement-types.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

/** Tipos de medida ativos para o card "Medidas corporais" (todas as clínicas veem os mesmos). */
@UseGuards(JwtAuthGuard)
@Controller('measurement-types')
export class MeasurementTypesReadController {
  constructor(private readonly types: MeasurementTypesService) {}

  @Get()
  list() {
    return this.types.listActive();
  }
}
