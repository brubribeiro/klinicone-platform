import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { CatalogsReadController } from '../catalogs/catalogs-read.controller';
import { MeasurementTypesReadController } from '../catalogs/measurement-types-read.controller';
import { AdminController } from './admin.controller';
import { AnnouncementsController } from './announcements.controller';
import { AnnouncementsService } from './announcements.service';
import { AdminService } from './admin.service';
import { CatalogsController } from './catalogs.controller';
import { CatalogsService } from './catalogs.service';
import { FeedbackAdminService } from './feedback-admin.service';
import { MeasurementTypesController } from './measurement-types.controller';
import { MeasurementTypesService } from './measurement-types.service';
import { ObservabilityService } from './observability.service';
import { PlatformInsightsController } from './platform-insights.controller';
import { PlansController } from './plans.controller';
import { PlansService } from './plans.service';
import { SuperAdminsController } from './super-admins.controller';
import { SuperAdminsService } from './super-admins.service';
import { UsageService } from './usage.service';

@Module({
  imports: [AuthModule],
  providers: [
    AdminService,
    AnnouncementsService,
    CatalogsService,
    PlansService,
    UsageService,
    FeedbackAdminService,
    ObservabilityService,
    MeasurementTypesService,
    SuperAdminsService,
  ],
  controllers: [
    AdminController,
    AnnouncementsController,
    CatalogsController,
    CatalogsReadController,
    MeasurementTypesController,
    MeasurementTypesReadController,
    PlansController,
    PlatformInsightsController,
    SuperAdminsController,
  ],
  exports: [CatalogsService],
})
export class AdminModule {}
