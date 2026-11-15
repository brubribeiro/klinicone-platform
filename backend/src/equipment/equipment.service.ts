import { Injectable, NotFoundException } from '@nestjs/common';
import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { NotificationType } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { parseDateOnlyToUtcNoon } from '../common/utils/date-only.util';
import { AuditLogService, AuditUser } from '../audit-log/audit-log.service';
import { assertDeletable, dependency } from '../common/deletion/deletion-dependencies';

export class CreateEquipmentDto {
  @IsString()
  name: string;

  @IsOptional() @IsString()
  brand?: string;

  @IsOptional() @IsString()
  model?: string;

  @IsOptional() @IsString()
  serialNumber?: string;

  @IsOptional() @IsDateString()
  purchaseDate?: string;

  @IsOptional() @IsNumber()
  purchaseValue?: number;

  @IsOptional() @IsNumber()
  maintenanceValue?: number;

  @IsOptional() @IsInt() @Min(1)
  maintenanceIntervalMonths?: number;

  @IsOptional() @IsInt() @Min(1)
  maintenanceNotifyDaysBefore?: number;

  @IsOptional() @IsDateString()
  lastMaintenanceAt?: string;

  @IsOptional() @IsDateString()
  scheduledMaintenanceAt?: string;

  @IsOptional() @IsString()
  notes?: string;

  @IsOptional() @IsBoolean()
  active?: boolean;
}

export class UpdateEquipmentDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() brand?: string;
  @IsOptional() @IsString() model?: string;
  @IsOptional() @IsString() serialNumber?: string;
  @IsOptional() @IsDateString() purchaseDate?: string;
  @IsOptional() @IsNumber() purchaseValue?: number;
  @IsOptional() @IsNumber() maintenanceValue?: number;
  @IsOptional() @IsInt() @Min(1) maintenanceIntervalMonths?: number;
  @IsOptional() @IsInt() @Min(1) maintenanceNotifyDaysBefore?: number;
  @IsOptional() @IsDateString() lastMaintenanceAt?: string;
  @IsOptional() @IsDateString() scheduledMaintenanceAt?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}

function nextFromLast(last: Date | null | undefined, months: number | null | undefined) {
  if (!last || !months) return null;
  const d = new Date(last);
  d.setMonth(d.getMonth() + months);
  return d;
}

@Injectable()
export class EquipmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly auditLog: AuditLogService,
  ) {}

  list() {
    return this.prisma.equipment.findMany({ orderBy: { name: 'asc' } });
  }

  async findOne(id: string) {
    const e = await this.prisma.equipment.findUnique({ where: { id } });
    if (!e) throw new NotFoundException('Equipamento não encontrado');
    return e;
  }

  async create(dto: CreateEquipmentDto, user?: AuditUser) {
    const last = parseDateOnlyToUtcNoon(dto.lastMaintenanceAt) ?? null;
    const nextMaintenanceAt = nextFromLast(last, dto.maintenanceIntervalMonths);

    const equipment = await this.prisma.equipment.create({
      data: {
        name: dto.name,
        brand: dto.brand,
        model: dto.model,
        serialNumber: dto.serialNumber,
        purchaseDate: parseDateOnlyToUtcNoon(dto.purchaseDate) ?? null,
        purchaseValue: dto.purchaseValue,
        maintenanceValue: dto.maintenanceValue,
        maintenanceIntervalMonths: dto.maintenanceIntervalMonths,
        maintenanceNotifyDaysBefore: dto.maintenanceNotifyDaysBefore,
        lastMaintenanceAt: last,
        nextMaintenanceAt,
        scheduledMaintenanceAt: parseDateOnlyToUtcNoon(dto.scheduledMaintenanceAt) ?? null,
        notes: dto.notes,
        active: dto.active ?? true,
      },
    });

    this.auditLog.logCreate('Equipment', equipment.id, equipment as unknown as Record<string, unknown>, user).catch(() => undefined);

    // Se já tem manutenção agendada, cria despesa automaticamente
    if (dto.scheduledMaintenanceAt && dto.maintenanceValue) {
      await this.createMaintenanceExpense(
        equipment.id,
        equipment.name,
        dto.maintenanceValue,
        parseDateOnlyToUtcNoon(dto.scheduledMaintenanceAt)!,
      );
    }

    return equipment;
  }

  async update(id: string, dto: UpdateEquipmentDto, user?: AuditUser) {
    const before = await this.findOne(id);
    const last =
      dto.lastMaintenanceAt !== undefined
        ? parseDateOnlyToUtcNoon(dto.lastMaintenanceAt) ?? null
        : before.lastMaintenanceAt;
    const interval =
      dto.maintenanceIntervalMonths !== undefined
        ? dto.maintenanceIntervalMonths
        : before.maintenanceIntervalMonths;
    const nextMaintenanceAt = nextFromLast(last, interval ?? null);

    const updated = await this.prisma.equipment.update({
      where: { id },
      data: {
        ...dto,
        purchaseDate:
          dto.purchaseDate !== undefined
            ? parseDateOnlyToUtcNoon(dto.purchaseDate) ?? null
            : undefined,
        lastMaintenanceAt:
          dto.lastMaintenanceAt !== undefined
            ? parseDateOnlyToUtcNoon(dto.lastMaintenanceAt) ?? null
            : undefined,
        scheduledMaintenanceAt:
          dto.scheduledMaintenanceAt !== undefined
            ? parseDateOnlyToUtcNoon(dto.scheduledMaintenanceAt) ?? null
            : undefined,
        nextMaintenanceAt,
      },
    });

    this.auditLog.logUpdate('Equipment', id, before as unknown as Record<string, unknown>, updated as unknown as Record<string, unknown>, user).catch(() => undefined);

    // Se a data de manutenção agendada mudou e há valor de manutenção, gera despesa
    const newScheduled = parseDateOnlyToUtcNoon(dto.scheduledMaintenanceAt) ?? null;
    const oldScheduled = before.scheduledMaintenanceAt;
    const scheduledChanged =
      dto.scheduledMaintenanceAt !== undefined &&
      newScheduled?.getTime() !== oldScheduled?.getTime();

    if (scheduledChanged && newScheduled) {
      const value = dto.maintenanceValue ?? Number(before.maintenanceValue ?? null);
      if (value) {
        await this.createMaintenanceExpense(id, updated.name, value, newScheduled);
      }
    }

    return updated;
  }

  /** Marca manutenção como feita agora e recalcula próxima. */
  async registerMaintenance(id: string) {
    const e = await this.findOne(id);
    const now = new Date();
    const next = nextFromLast(now, e.maintenanceIntervalMonths);
    return this.prisma.equipment.update({
      where: { id },
      data: {
        lastMaintenanceAt: now,
        nextMaintenanceAt: next,
        scheduledMaintenanceAt: null, // limpa o agendamento concluído
      },
    });
  }

  async remove(id: string, user?: AuditUser, unlink = false) {
    const oldData = await this.findOne(id);
    const unlinked = await this.prisma.$transactionWithRetry(async (tx) => {
      const [procedures, documents, financialCount] = await Promise.all([
        tx.procedureEquipment.findMany({
          where: { equipmentId: id },
          select: { procedure: { select: { name: true } } },
        }),
        tx.document.findMany({ where: { equipmentId: id }, select: { name: true } }),
        tx.financialEntry.count({ where: { equipmentId: id } }),
      ]);
      const deps = assertDeletable(
        `o equipamento "${oldData.name}"`,
        [
          dependency({
            type: 'procedures',
            label: 'Procedimentos',
            count: procedures.length,
            names: procedures.map((p) => p.procedure.name),
            unlinkable: true,
            note: 'O equipamento sai da lista desses procedimentos.',
          }),
          dependency({
            type: 'documents',
            label: 'Documentos',
            count: documents.length,
            names: documents.map((d) => d.name),
            unlinkable: true,
            note: 'Os documentos continuam salvos, sem o vínculo com o equipamento.',
          }),
          dependency({
            type: 'financialEntries',
            label: 'Lançamentos financeiros',
            count: financialCount,
            unlinkable: true,
            note: 'Os lançamentos continuam no financeiro, sem o vínculo com o equipamento.',
          }),
        ],
        { unlink },
      );
      await tx.procedureEquipment.deleteMany({ where: { equipmentId: id } });
      await tx.document.updateMany({ where: { equipmentId: id }, data: { equipmentId: null } });
      await tx.financialEntry.updateMany({ where: { equipmentId: id }, data: { equipmentId: null } });
      await tx.equipment.delete({ where: { id } });
      return deps;
    });
    this.auditLog
      .logDelete('Equipment', id, { ...oldData, unlinkedDependencies: unlinked } as unknown as Record<string, unknown>, user)
      .catch(() => undefined);
    return { ok: true, unlinked };
  }


  /** Lista equipamentos cuja próxima manutenção é em até X dias (default 30). */
  async dueSoon(days = 30) {
    const limit = new Date();
    limit.setDate(limit.getDate() + days);
    return this.prisma.equipment.findMany({
      where: {
        active: true,
        OR: [
          { nextMaintenanceAt: { not: null, lte: limit } },
          { scheduledMaintenanceAt: { not: null, lte: limit } },
        ],
      },
      orderBy: { nextMaintenanceAt: 'asc' },
    });
  }

  /**
   * Verifica equipamentos que precisam de notificação de manutenção
   * com base no campo maintenanceNotifyDaysBefore de cada um.
   */
  async checkMaintenanceNotifications() {
    const equipments = await this.prisma.equipment.findMany({
      where: {
        active: true,
        maintenanceNotifyDaysBefore: { not: null },
        OR: [
          { nextMaintenanceAt: { not: null } },
          { scheduledMaintenanceAt: { not: null } },
        ],
      },
    });

    const now = new Date();
    const admins = await this.prisma.user.findMany({
      where: { role: { permissions: { has: 'equipment:view' } } },
      select: { id: true },
    });

    for (const eq of equipments) {
      const notifyDays = eq.maintenanceNotifyDaysBefore!;
      const targetDate = eq.scheduledMaintenanceAt ?? eq.nextMaintenanceAt;
      if (!targetDate) continue;

      const diffMs = targetDate.getTime() - now.getTime();
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      if (diffDays >= 0 && diffDays <= notifyDays) {
        for (const admin of admins) {
          // Evita duplicar notificação: verifica se já existe uma recente
          const existing = await this.prisma.notification.findFirst({
            where: {
              userId: admin.id,
              type: 'EQUIPMENT_MAINTENANCE',
              metadata: { path: ['equipmentId'], equals: eq.id },
              createdAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
            },
          });
          if (existing) continue;

          await this.notifications.notify({
            userId: admin.id,
            type: NotificationType.EQUIPMENT_MAINTENANCE,
            title: `Manutenção próxima: ${eq.name}`,
            message: `A manutenção de ${eq.name} está prevista para ${targetDate.toLocaleDateString('pt-BR')} (em ${diffDays} dia${diffDays !== 1 ? 's' : ''}).`,
            link: '/equipamentos',
            metadata: { equipmentId: eq.id },
          });
        }
      }
    }
  }

  /** Cria uma despesa (EXPENSE) vinculada ao equipamento para a manutenção agendada. */
  private async createMaintenanceExpense(
    equipmentId: string,
    equipmentName: string,
    value: number,
    scheduledDate: Date,
  ) {
    // Verifica se já existe despesa de manutenção para este equipamento neste mês
    const monthStart = new Date(scheduledDate.getFullYear(), scheduledDate.getMonth(), 1);
    const monthEnd = new Date(scheduledDate.getFullYear(), scheduledDate.getMonth() + 1, 0);

    const existing = await this.prisma.financialEntry.findFirst({
      where: {
        equipmentId,
        type: 'EXPENSE',
        category: 'Manutenção de equipamento',
        dueDate: { gte: monthStart, lte: monthEnd },
      },
    });

    if (existing) return existing; // Já existe despesa para este mês

    return this.prisma.financialEntry.create({
      data: {
        type: 'EXPENSE',
        description: `Manutenção - ${equipmentName}`,
        amount: value,
        category: 'Manutenção de equipamento',
        dueDate: scheduledDate,
        equipmentId,
        expenseType: 'VARIABLE',
      },
    });
  }
}
