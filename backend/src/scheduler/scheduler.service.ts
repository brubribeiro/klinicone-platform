import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { NotificationType } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EquipmentService } from '../equipment/equipment.service';
import { MessageDispatchService } from '../messages/message-dispatch.service';
import { TenantContext } from '../tenancy/tenant-context';

const CHECK_INTERVAL_MS = 60 * 60 * 1000;
const KEEP_ALIVE_INTERVAL_MS = 4.5 * 60 * 1000;
const KEEP_ALIVE_START_HOUR = 7;
const KEEP_ALIVE_END_HOUR = 21;

@Injectable()
export class SchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SchedulerService.name);
  private intervalRef: ReturnType<typeof setInterval> | null = null;
  private keepAliveRef: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly equipment: EquipmentService,
    private readonly messageDispatches: MessageDispatchService,
  ) {}

  onModuleInit() {
    this.runAll().catch((e) => this.logger.error('Scheduler init error', e));
    this.intervalRef = setInterval(
      () => this.runAll().catch((e) => this.logger.error('Scheduler error', e)),
      CHECK_INTERVAL_MS,
    );

    this.keepAliveRef = setInterval(
      () => this.keepAlive().catch((e) => this.logger.error('Keep-alive error', e)),
      KEEP_ALIVE_INTERVAL_MS,
    );

    this.logger.log(
      'Scheduler iniciado — verificações a cada 1h (incl. gatilhos WhatsApp), keep-alive a cada 4.5 min (7h–21h)',
    );
  }

  onModuleDestroy() {
    if (this.intervalRef) clearInterval(this.intervalRef);
    if (this.keepAliveRef) clearInterval(this.keepAliveRef);
  }

  /** Roda as verificações uma clínica por vez, cada uma no próprio contexto de tenant. */
  private async runAll() {
    const tenants = await TenantContext.runUnscoped(() =>
      this.prisma.tenant.findMany({ where: { active: true }, select: { id: true, slug: true, name: true } }),
    );
    for (const tenant of tenants) {
      await TenantContext.run(tenant.id, () => this.runAllForTenant(tenant.name)).catch((e) =>
        this.logger.error(`Scheduler error (clínica ${tenant.slug})`, e),
      );
    }
  }

  private async runAllForTenant(clinicName: string) {
    await Promise.allSettled([
      this.checkEquipmentMaintenance(),
      this.checkInventoryExpiring(),
      this.checkPatientReturnDue(),
      this.checkPatientReactivation(),
      this.checkMessageTriggers(clinicName),
    ]);
  }

  private async checkMessageTriggers(clinicName: string) {
    try {
      await this.messageDispatches.processAutoTriggers(clinicName);
    } catch (e) {
      this.logger.error('Erro ao processar gatilhos de mensagens WhatsApp', e);
    }
  }

  private async keepAlive() {
    const hour = new Date().getHours();
    if (hour < KEEP_ALIVE_START_HOUR || hour >= KEEP_ALIVE_END_HOUR) return;

    await TenantContext.runUnscoped(() => this.prisma.$queryRaw`SELECT 1`);
  }

  private async checkEquipmentMaintenance() {
    try {
      await this.equipment.checkMaintenanceNotifications();
    } catch (e) {
      this.logger.error('Erro ao verificar manutenção de equipamentos', e);
    }
  }

  private async checkInventoryExpiring() {
    try {
      const items = await this.prisma.inventoryItem.findMany({
        where: {
          expiresAt: { not: null },
          expiryNotifyDaysBefore: { not: null },
          quantity: { gt: 0 },
        },
      });

      const now = new Date();
      const recipients = await this.notifications.findUsersWithPermission('inventory:view');
      if (recipients.length === 0) return;

      for (const item of items) {
        const expiresAt = item.expiresAt!;
        const notifyDays = item.expiryNotifyDaysBefore!;

        const diffMs = expiresAt.getTime() - now.getTime();
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays <= notifyDays) {
          const isExpired = diffDays <= 0;
          const title = isExpired
            ? `Produto vencido: ${item.name}`
            : `Produto vencendo: ${item.name}`;
          const message = isExpired
            ? `${item.name} venceu em ${expiresAt.toLocaleDateString('pt-BR')}.`
            : `${item.name} vence em ${expiresAt.toLocaleDateString('pt-BR')} (${diffDays} dia${diffDays !== 1 ? 's' : ''}).`;

          for (const user of recipients) {
            const existing = await this.prisma.notification.findFirst({
              where: {
                userId: user.id,
                type: 'INVENTORY_EXPIRING',
                metadata: { path: ['itemId'], equals: item.id },
                createdAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
              },
            });
            if (existing) continue;

            await this.notifications.notify({
              userId: user.id,
              type: NotificationType.INVENTORY_EXPIRING,
              title,
              message,
              link: `/estoque/${item.id}`,
              metadata: { itemId: item.id },
            });
          }
        }
      }
    } catch (e) {
      this.logger.error('Erro ao verificar validade do estoque', e);
    }
  }

  private async checkPatientReturnDue() {
    try {
      const completedAppts = await this.prisma.appointment.findMany({
        where: {
          status: 'COMPLETED',
          procedure: { recurrenceDays: { not: null } },
        },
        include: {
          patient: { select: { id: true, name: true } },
          procedure: { select: { id: true, name: true, recurrenceDays: true } },
        },
        orderBy: { startAt: 'desc' },
      });

      if (completedAppts.length === 0) return;

      const now = new Date();
      const recipients = await this.notifications.findUsersWithPermission('patients:view');
      if (recipients.length === 0) return;

      const latestByPatientProc = new Map<string, typeof completedAppts[0]>();
      for (const appt of completedAppts) {
        if (!appt.procedureId || !appt.patientId) continue;
        const key = `${appt.patientId}::${appt.procedureId}`;
        if (!latestByPatientProc.has(key)) {
          latestByPatientProc.set(key, appt);
        }
      }

      for (const [key, appt] of latestByPatientProc) {
        const recDays = appt.procedure?.recurrenceDays;
        if (!recDays) continue;

        const dueDate = new Date(appt.startAt);
        dueDate.setDate(dueDate.getDate() + recDays);

        if (dueDate.getTime() > now.getTime()) continue;

        const futureAppt = await this.prisma.appointment.findFirst({
          where: {
            patientId: appt.patientId,
            procedureId: appt.procedureId,
            startAt: { gte: appt.startAt },
            id: { not: appt.id },
            status: { notIn: ['CANCELLED', 'NO_SHOW'] },
          },
        });
        if (futureAppt) continue;

        const diffDays = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

        for (const user of recipients) {
          const existing = await this.prisma.notification.findFirst({
            where: {
              userId: user.id,
              type: 'PATIENT_RETURN_DUE',
              metadata: { path: ['patientId'], equals: appt.patientId },
              createdAt: { gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) },
            },
          });
          if (existing) continue;

          await this.notifications.notify({
            userId: user.id,
            type: NotificationType.PATIENT_RETURN_DUE,
            title: `Retorno pendente: ${appt.patient?.name}`,
            message: `${appt.procedure?.name} — retorno era previsto há ${diffDays} dia${diffDays !== 1 ? 's' : ''}.`,
            link: '/pacientes',
            metadata: {
              patientId: appt.patientId,
              procedureId: appt.procedureId,
              appointmentId: appt.id,
            },
          });
        }
      }
    } catch (e) {
      this.logger.error('Erro ao verificar retornos de pacientes', e);
    }
  }

  private async checkPatientReactivation() {
    try {
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

      const allPatients = await this.prisma.patient.findMany({
        select: { id: true, name: true },
      });

      const now = new Date();
      const recipients = await this.notifications.findUsersWithPermission('patients:view');
      if (recipients.length === 0) return;

      for (const patient of allPatients) {
        const hasHistory = await this.prisma.appointment.findFirst({
          where: { patientId: patient.id, status: 'COMPLETED' },
          select: { id: true },
        });
        if (!hasHistory) continue;

        const recentAppt = await this.prisma.appointment.findFirst({
          where: {
            patientId: patient.id,
            startAt: { gte: threeMonthsAgo },
            status: { notIn: ['CANCELLED'] },
          },
          select: { id: true },
        });
        if (recentAppt) continue;

        const lastAppt = await this.prisma.appointment.findFirst({
          where: {
            patientId: patient.id,
            status: { notIn: ['CANCELLED'] },
          },
          orderBy: { startAt: 'desc' },
          select: { startAt: true },
        });
        if (!lastAppt) continue;

        const daysSinceLast = Math.floor(
          (now.getTime() - lastAppt.startAt.getTime()) / (1000 * 60 * 60 * 24),
        );
        const monthsSinceLast = Math.floor(daysSinceLast / 30);

        for (const user of recipients) {
          const existing = await this.prisma.notification.findFirst({
            where: {
              userId: user.id,
              type: 'PATIENT_REACTIVATION',
              metadata: { path: ['patientId'], equals: patient.id },
              createdAt: { gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) },
            },
          });
          if (existing) continue;

          await this.notifications.notify({
            userId: user.id,
            type: NotificationType.PATIENT_REACTIVATION,
            title: `Reativação: ${patient.name}`,
            message: `Sem atendimento há ${monthsSinceLast} mes${monthsSinceLast !== 1 ? 'es' : ''} (${daysSinceLast} dias).`,
            link: '/pacientes',
            metadata: { patientId: patient.id },
          });
        }
      }
    } catch (e) {
      this.logger.error('Erro ao verificar reativação de pacientes', e);
    }
  }
}
