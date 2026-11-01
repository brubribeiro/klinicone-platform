import { Controller, Get, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ClinicAdminGuard } from '../common/guards/clinic-admin.guard';
import { CurrentUser, type AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { TenantPlanService } from './tenant-plan.service';

@UseGuards(JwtAuthGuard, ClinicAdminGuard)
@Controller('tenant/plan')
export class TenantPlanController {
  constructor(private readonly tenantPlan: TenantPlanService) {}

  /** Plano, limites (aplicados em src/plan-limits) e consumo atual da clínica (somente admin). */
  @Get()
  getPlan(@CurrentUser() user: AuthenticatedUser) {
    return this.tenantPlan.getSummary(user.tenantId!);
  }
}
