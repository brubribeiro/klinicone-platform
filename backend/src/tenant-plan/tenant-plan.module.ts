import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { TenantPlanController } from './tenant-plan.controller';
import { TenantPlanService } from './tenant-plan.service';

@Module({
  imports: [PrismaModule],
  controllers: [TenantPlanController],
  providers: [TenantPlanService],
})
export class TenantPlanModule {}
