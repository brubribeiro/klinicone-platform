import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService, AuditUser } from '../audit-log/audit-log.service';
import { assertDeletable, dependency } from '../common/deletion/deletion-dependencies';
import {
  computeHourlyCostSummary,
  getHourlyCostIncludeVariable,
} from '../common/utils/hourly-cost.util';
import { CreateProcedureDto, ProcedureMaterialDto } from './dto/create-procedure.dto';
import { UpdateProcedureDto } from './dto/update-procedure.dto';

export interface ProcedureFinancials {
  baseCost: number;
  equipmentCost: number;
  maxFeePercent: number;
  maxFeeCost: number;
  fixedCostShare: number;
  hourlyCost: number;
  totalCost: number;
  profitMargin: number;
}

@Injectable()
export class ProceduresService {
  constructor(private readonly prisma: PrismaService, private readonly auditLog: AuditLogService) {}

  /** Calcula todos os indicadores financeiros de um procedimento. */
  private computeFinancials(
    price: number,
    durationMinutes: number,
    materials: any[],
    equipments: any[],
    maxFeePercent: number,
    hourlyCost: number,
  ): ProcedureFinancials {
    const baseCost = (materials ?? []).reduce(
      (sum, m) => sum + Number(m.item?.costPrice ?? 0) * Number(m.quantity ?? 0),
      0,
    );
    const equipmentCost = (equipments ?? []).reduce(
      (sum, e) => sum + Number(e.costPerUse ?? 0),
      0,
    );
    const maxFeeCost = price * (maxFeePercent / 100);
    // Despesa fixa proporcional ao tempo do procedimento
    const fixedCostShare = hourlyCost * (durationMinutes / 60);
    const totalCost = baseCost + equipmentCost + maxFeeCost + fixedCostShare;
    const profitMargin = price > 0
      ? Math.round(((price - totalCost) / price) * 10000) / 100
      : 0;
    return {
      baseCost: Math.round(baseCost * 100) / 100,
      equipmentCost: Math.round(equipmentCost * 100) / 100,
      maxFeePercent,
      maxFeeCost: Math.round(maxFeeCost * 100) / 100,
      fixedCostShare: Math.round(fixedCostShare * 100) / 100,
      hourlyCost: Math.round(hourlyCost * 100) / 100,
      totalCost: Math.round(totalCost * 100) / 100,
      profitMargin,
    };
  }

  /**
   * Calcula custo/hora = despesas fixas mensais ÷ carga horária mensal
   * da profissional principal (configurada via MAIN_PROFESSIONAL_EMAIL).
   */
  private async getSharedCosts() {
    const maxFee = await this.prisma.paymentMethod.findFirst({
      where: { active: true },
      orderBy: { feePercent: 'desc' },
    });
    const maxFeePercent = maxFee ? Number(maxFee.feePercent) : 0;

    const includeVariable = await getHourlyCostIncludeVariable(this.prisma);
    const summary = await computeHourlyCostSummary(this.prisma, {
      useRecurringCatalog: false,
      includeVariable,
    });

    return { maxFeePercent, hourlyCost: summary.hourlyCost };
  }

  async list() {
    const [items, shared, doneCounts] = await Promise.all([
      this.prisma.procedure.findMany({
        orderBy: { name: 'asc' },
        include: {
          materials: { include: { item: true } },
          equipments: { include: { equipment: { select: { id: true, name: true } } } },
        },
      }),
      this.getSharedCosts(),
      this.prisma.appointment.groupBy({
        by: ['procedureId'],
        where: { status: 'COMPLETED', procedureId: { not: null } },
        _count: { id: true },
      }),
    ]);

    const doneMap = new Map<string, number>();
    for (const row of doneCounts) {
      if (row.procedureId) doneMap.set(row.procedureId, row._count.id);
    }

    return items.map((p) => ({
      ...p,
      appointmentsCount: doneMap.get(p.id) ?? 0,
      ...this.computeFinancials(
        Number(p.price),
        p.durationMinutes,
        p.materials,
        p.equipments,
        shared.maxFeePercent,
        shared.hourlyCost,
      ),
    }));
  }

  private readonly procedureInclude = {
    materials: { include: { item: true } },
    equipments: { include: { equipment: { select: { id: true, name: true } } } },
  } as const;

  async findOne(id: string) {
    const p = await this.prisma.procedure.findUnique({
      where: { id },
      include: this.procedureInclude,
    });
    if (!p) throw new NotFoundException('Procedimento não encontrado');
    const shared = await this.getSharedCosts();
    return {
      ...p,
      ...this.computeFinancials(Number(p.price), p.durationMinutes, p.materials, p.equipments, shared.maxFeePercent, shared.hourlyCost),
    };
  }

  async create(dto: CreateProcedureDto, user?: AuditUser) {
    const { materials, equipments, ...data } = dto;
    const created = await this.prisma.procedure.create({
      data: {
        ...data,
        materials: materials?.length
          ? { create: materials.map((m) => ({ itemId: m.itemId, quantity: m.quantity })) }
          : undefined,
        equipments: equipments?.length
          ? { create: equipments.map((e) => ({ equipmentId: e.equipmentId, costPerUse: e.costPerUse ?? 0 })) }
          : undefined,
      },
      include: this.procedureInclude,
    });
    this.auditLog.logCreate('Procedure', created.id, created as unknown as Record<string, unknown>, user).catch(() => undefined);
    const shared = await this.getSharedCosts();
    return {
      ...created,
      ...this.computeFinancials(Number(created.price), created.durationMinutes, created.materials, created.equipments, shared.maxFeePercent, shared.hourlyCost),
    };
  }

  async update(id: string, dto: UpdateProcedureDto, user?: AuditUser) {
    const oldProcedure = await this.findOne(id);
    const { materials, equipments, ...data } = dto;

    const updated = await this.prisma.$transactionWithRetry(async (tx) => {
      if (materials !== undefined) {
        await tx.procedureMaterial.deleteMany({ where: { procedureId: id } });
        if (materials.length > 0) {
          await tx.procedureMaterial.createMany({
            data: materials.map((m: ProcedureMaterialDto) => ({
              procedureId: id,
              itemId: m.itemId,
              quantity: m.quantity,
            })),
          });
        }
      }
      if (equipments !== undefined) {
        await tx.procedureEquipment.deleteMany({ where: { procedureId: id } });
        if (equipments.length > 0) {
          await tx.procedureEquipment.createMany({
            data: equipments.map((e) => ({
              procedureId: id,
              equipmentId: e.equipmentId,
              costPerUse: e.costPerUse ?? 0,
            })),
          });
        }
      }
      return tx.procedure.update({
        where: { id },
        data,
        include: this.procedureInclude,
      });
    });
    this.auditLog.logUpdate('Procedure', id, oldProcedure as unknown as Record<string, unknown>, updated as unknown as Record<string, unknown>, user).catch(() => undefined);
    const shared = await this.getSharedCosts();
    return {
      ...updated,
      ...this.computeFinancials(Number(updated.price), updated.durationMinutes, updated.materials, updated.equipments, shared.maxFeePercent, shared.hourlyCost),
    };
  }

  async remove(id: string, user?: AuditUser, unlink = false) {
    const old = await this.findOne(id);
    const unlinked = await this.prisma.$transactionWithRetry(async (tx) => {
      const [appointmentCount, packageItems, promotions, messageTemplates] = await Promise.all([
        tx.appointment.count({
          where: {
            OR: [{ procedureId: id }, { appointmentProcedures: { some: { procedureId: id } } }],
          },
        }),
        tx.packageItem.findMany({
          where: { procedureId: id },
          select: { package: { select: { name: true } } },
        }),
        tx.promotionProcedure.findMany({
          where: { procedureId: id },
          select: { promotion: { select: { name: true } } },
        }),
        tx.messageTemplate.findMany({ where: { procedureId: id }, select: { name: true } }),
      ]);
      const deps = assertDeletable(
        `o procedimento "${old.name}"`,
        [
          dependency({
            type: 'appointments',
            label: 'Atendimentos',
            count: appointmentCount,
            unlinkable: false,
            note: 'Atendimentos fazem parte do histórico clínico e não podem ser desvinculados.',
          }),
          dependency({
            type: 'packages',
            label: 'Pacotes',
            count: packageItems.length,
            names: packageItems.map((i) => i.package.name),
            unlinkable: true,
            note: 'O procedimento sai da composição desses pacotes; pacotes já vendidos não mudam.',
          }),
          dependency({
            type: 'promotions',
            label: 'Promoções',
            count: promotions.length,
            names: promotions.map((p) => p.promotion.name),
            unlinkable: true,
            note: 'O procedimento sai dessas promoções.',
          }),
          dependency({
            type: 'messageTemplates',
            label: 'Modelos de mensagem',
            count: messageTemplates.length,
            names: messageTemplates.map((t) => t.name),
            unlinkable: true,
            note: 'Os modelos continuam, sem o vínculo com o procedimento.',
          }),
        ],
        { unlink, blockedHint: 'Inative o procedimento para que ele deixe de aparecer nas opções.' },
      );
      await tx.packageItem.deleteMany({ where: { procedureId: id } });
      await tx.promotionProcedure.deleteMany({ where: { procedureId: id } });
      await tx.messageTemplate.updateMany({ where: { procedureId: id }, data: { procedureId: null } });
      await tx.procedure.delete({ where: { id } });
      return deps;
    });
    this.auditLog
      .logDelete('Procedure', id, { ...old, unlinkedDependencies: unlinked } as unknown as Record<string, unknown>, user)
      .catch(() => undefined);
    return { ok: true, unlinked };
  }

}
