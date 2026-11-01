import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { RequestLoggerMiddleware } from './common/middleware/request-logger.middleware';
import { TenantContextMiddleware } from './tenancy/tenant-context.middleware';

import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { RolesModule } from './roles/roles.module';
import { PatientsModule } from './patients/patients.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { ProceduresModule } from './procedures/procedures.module';
import { FinanceModule } from './finance/finance.module';
import { InventoryModule } from './inventory/inventory.module';
import { NotificationsModule } from './notifications/notifications.module';
import { MessagesModule } from './messages/messages.module';
import { AvailabilityModule } from './availability/availability.module';
import { EquipmentModule } from './equipment/equipment.module';
import { DocumentsModule } from './documents/documents.module';
import { RecurringExpensesModule } from './recurring-expenses/recurring-expenses.module';
import { PackagesModule } from './packages/packages.module';
import { MetricsModule } from './metrics/metrics.module';
import { PromotionsModule } from './promotions/promotions.module';
import { PaymentMethodsModule } from './payment-methods/payment-methods.module';
import { FeedbackModule } from './feedback/feedback.module';
import { GoalsModule } from './goals/goals.module';
import { PendenciasModule } from './pendencias/pendencias.module';
import { SkincareModule } from './skincare/skincare.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { AuditLogModule } from './audit-log/audit-log.module';
import { AdminModule } from './admin/admin.module';
import { PlanLimitsModule } from './plan-limits/plan-limits.module';
import { TenantPlanModule } from './tenant-plan/tenant-plan.module';
import { PublicModule } from './public/public.module';
import { AssistantModule } from './assistant/assistant.module';
import { ObservabilityModule } from './observability/observability.module';
import { ApiMetricsMiddleware } from './observability/api-metrics.middleware';
import { AppController } from './app.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 60 }]),
    PrismaModule,
    ObservabilityModule,
    PlanLimitsModule,
    AuthModule,
    UsersModule,
    RolesModule,
    PatientsModule,
    AppointmentsModule,
    ProceduresModule,
    FinanceModule,
    InventoryModule,
    NotificationsModule,
    MessagesModule,
    AvailabilityModule,
    EquipmentModule,
    DocumentsModule,
    RecurringExpensesModule,
    PackagesModule,
    MetricsModule,
    PromotionsModule,
    PaymentMethodsModule,
    FeedbackModule,
    GoalsModule,
    PendenciasModule,
    SkincareModule,
    SchedulerModule,
    AuditLogModule,
    AdminModule,
    TenantPlanModule,
    PublicModule,
    AssistantModule,
  ],
  controllers: [AppController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantContextMiddleware, RequestLoggerMiddleware, ApiMetricsMiddleware).forRoutes('*');
  }
}
