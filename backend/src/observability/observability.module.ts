import { Module } from '@nestjs/common';

import { ApiMetricsService } from './api-metrics.service';

@Module({
  providers: [ApiMetricsService],
  exports: [ApiMetricsService],
})
export class ObservabilityModule {}
