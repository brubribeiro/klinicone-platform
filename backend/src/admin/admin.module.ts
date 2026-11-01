import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { CatalogsReadController } from '../catalogs/catalogs-read.controller';
import { AdminController } from './admin.controller';
import { AnnouncementsController } from './announcements.controller';
import { AnnouncementsService } from './announcements.service';
import { AdminService } from './admin.service';
import { CatalogsController } from './catalogs.controller';
import { CatalogsService } from './catalogs.service';
import { FeedbackAdminService } from './feedback-admin.service';
import { ObservabilityService } from './observability.service';
import { PlatformInsightsController } from './platform-insights.controller';
import { PlansController } from './plans.controller';
import { PlansService } from './plans.service';
import { UsageService } from './usage.service';

@Module({
  imports: [AuthModule],
  providers: [AdminService, AnnouncementsService, CatalogsService, PlansService, UsageService, FeedbackAdminService, ObservabilityService],
  controllers: [
    AdminController,
    AnnouncementsController,
    CatalogsController,
    CatalogsReadController,
    PlansController,
    PlatformInsightsController,
  ],
  exports: [CatalogsService],
})
export class AdminModule {}
