import { Injectable, NotFoundException } from '@nestjs/common';
import { AppointmentStatus, ExpenseType, FinancialType, Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { PromotionsService } from '../promotions/promotions.service';
import { toBrazilDateAtUtcNoon } from '../common/utils/brazil-time.util';
import { MaterialQuantity, resolveRevenuePaidAt } from './appointment.helpers';

type Tx = Prisma.TransactionClient;

export interface CompletionFinanceInput {
  appointmentId: string;
  patientId: string;
  startAt: Date;
  procedureIds: string[];
  packageId: string | null;
  extraMaterials: MaterialQuantity[];
  referenceMonth?: string;
  paymentMethodId?: string | null;
  installments?: number | null;
  cardBrand?: string | null;
  authorizationCode?: string | null;
}

/** Lançamentos financeiros (receita e custo de materiais) gerados ao concluir agendamentos. */
@Injectable()
export class AppointmentFinanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly promotionsService: PromotionsService,
  ) {}

  /**
   * Gera receita (com promoção, taxa da forma de pagamento e regra de pacote) e despesa de
   * materiais. Retorna false quando o procedimento não existe (nada é lançado).
   */
  async generateForCompletion(tx: Tx, input: CompletionFinanceInput): Promise<boolean> {
    const { appointmentId, patientId, procedureIds, packageId } = input;
    if (procedureIds.length === 0) return false;

    const procedures = await tx.procedure.findMany({
      where: { id: { in: procedureIds } },
      include: { materials: { include: { item: true } } },
    });
    if (procedures.length === 0) return false;

    const patient = await tx.patient.findUnique({ where: { id: patientId } });
    const patientName = patient?.name ?? 'Paciente';
    const revenuePaidAt = resolveRevenuePaidAt(input.referenceMonth, input.startAt);
    const pmId = input.paymentMethodId ?? null;
    let feePercent: number | undefined;
    if (pmId) {
      const pm = await tx.paymentMethod.findUnique({ where: { id: pmId } });
      if (pm) feePercent = Number(pm.feePercent);
    }

    const packageRevenue = packageId ? await this.resolvePackageRevenue(tx, packageId) : null;
    let promotionId: string | null = null;

    if (!packageRevenue?.alreadyGenerated) {
      if (packageId && packageRevenue?.patientPackage) {
        const label = procedures.map((p) => p.name).join(' + ');
        let finalAmount = packageRevenue.patientPackage.totalPaid;
        let netAmount: number | undefined;
        if (feePercent != null) {
          netAmount = Math.round(Number(finalAmount) * (1 - feePercent / 100) * 100) / 100;
        }
        await tx.financialEntry.create({
          data: {
            type: FinancialType.INCOME,
            description: `Pacote - ${label} - ${patientName}`,
            amount: finalAmount,
            netAmount,
            feePercent,
            paymentMethodId: pmId,
            installments: input.installments ?? null,
            cardBrand: input.cardBrand?.trim() || null,
            authorizationCode: input.authorizationCode?.trim() || null,
            category: 'Pacotes',
            paidAt: revenuePaidAt,
            patientId,
            appointmentId,
            invoiceIssued: false,
          },
        });
        if (packageId) await this.markPackageFinanceGenerated(tx, packageId);
      } else if (!packageId) {
        for (const procedure of procedures) {
          let finalAmount = procedure.price;
          let description = `${procedure.name} - ${patientName}`;
          const quote = await this.promotionsService.quoteForProcedure(
            procedure.id,
            Number(procedure.price),
            toBrazilDateAtUtcNoon(input.startAt),
          );
          if (quote.promotion) {
            finalAmount = new Prisma.Decimal(quote.finalPrice);
            description += ` (Promoção: ${quote.promotion.name} ${this.promotionsService.discountLabel(quote.promotion)})`;
            if (!promotionId) promotionId = quote.promotion.id;
          }
          let netAmount: number | undefined;
          if (feePercent != null) {
            netAmount = Math.round(Number(finalAmount) * (1 - feePercent / 100) * 100) / 100;
          }
          await tx.financialEntry.create({
            data: {
              type: FinancialType.INCOME,
              description,
              amount: finalAmount,
              netAmount,
              feePercent,
              paymentMethodId: pmId,
              installments: input.installments ?? null,
              cardBrand: input.cardBrand?.trim() || null,
              authorizationCode: input.authorizationCode?.trim() || null,
              category: 'Atendimentos',
              paidAt: revenuePaidAt,
              patientId,
              appointmentId,
              invoiceIssued: false,
            },
          });
        }
      }
    }

    const allMaterials = procedures.flatMap((p) => p.materials);
    const totalMaterialCost = await this.computeMaterialCost(tx, allMaterials, input.extraMaterials);
    if (totalMaterialCost > 0) {
      const label = procedures.map((p) => p.name).join(' + ');
      await tx.financialEntry.create({
        data: {
          type: FinancialType.EXPENSE,
          description: `Materiais - ${label} - ${patientName}`,
          amount: new Prisma.Decimal(Math.round(totalMaterialCost * 100) / 100),
          category: 'Materiais de procedimento',
          expenseType: ExpenseType.VARIABLE,
          paidAt: revenuePaidAt,
          patientId,
          appointmentId,
          invoiceIssued: false,
        },
      });
    }

    if (promotionId) {
      await tx.appointment.update({ where: { id: appointmentId }, data: { promotionId } });
    }

    return true;
  }

  /** Prévia da promoção de um procedimento avulso no dia do agendamento (`day` em meio-dia UTC). */
  async previewPromotion(procedureId: string, day: Date) {
    const procedure = await this.prisma.procedure.findUnique({
      where: { id: procedureId },
      select: { price: true },
    });
    if (!procedure) throw new NotFoundException('Procedimento não encontrado');
    return this.promotionsService.quoteForProcedure(procedureId, Number(procedure.price), day);
  }

  /** Lança receita de agendamentos concluídos que ainda não geraram financeiro. */
  async backfill() {
    const pending = await this.prisma.appointment.findMany({
      where: {
        status: AppointmentStatus.COMPLETED,
        financeGenerated: false,
        procedureId: { not: null },
      },
      include: { patient: true, procedure: true },
    });

    if (pending.length === 0) return { created: 0 };

    await this.prisma.$transactionWithRetry(async (tx) => {
      for (const appt of pending) {
        if (!appt.procedure) continue;

        const packageRevenue = appt.patientPackageId
          ? await this.resolvePackageRevenue(tx, appt.patientPackageId)
          : null;

        if (!packageRevenue?.alreadyGenerated) {
          let amount = appt.procedure.price;
          let description = `${appt.procedure.name} - ${appt.patient?.name ?? 'Paciente'}`;
          let category = 'Atendimentos';

          if (packageRevenue?.patientPackage) {
            amount = packageRevenue.patientPackage.totalPaid;
            description = `Pacote - ${description}`;
            category = 'Pacotes';
          }

          await tx.financialEntry.create({
            data: {
              type: FinancialType.INCOME,
              description,
              amount,
              category,
              paymentMethodId: null,
              paidAt: appt.updatedAt ?? appt.startAt,
              patientId: appt.patientId,
              appointmentId: appt.id,
              invoiceIssued: false,
            },
          });

          if (appt.patientPackageId) {
            await this.markPackageFinanceGenerated(tx, appt.patientPackageId);
          }
        }

        await tx.appointment.update({
          where: { id: appt.id },
          data: { financeGenerated: true },
        });
      }
    });

    return { created: pending.length };
  }

  /** Receita de pacote já lançada (pago antecipadamente ou em outro agendamento do pacote)? */
  private async resolvePackageRevenue(tx: Tx, packageId: string) {
    const patientPackage = await tx.patientPackage.findUnique({ where: { id: packageId } });
    if (patientPackage?.financeGenerated) return { alreadyGenerated: true, patientPackage };

    const existing = await tx.financialEntry.findFirst({
      where: { type: FinancialType.INCOME, appointment: { patientPackageId: packageId } },
    });
    return { alreadyGenerated: !!existing, patientPackage };
  }

  private markPackageFinanceGenerated(tx: Tx, packageId: string) {
    return tx.patientPackage.update({
      where: { id: packageId },
      data: { financeGenerated: true },
    });
  }

  /** Custo dos materiais do procedimento e extras (itens sem preço de custo não entram). */
  private async computeMaterialCost(
    tx: Tx,
    procedureMaterials: { quantity: Prisma.Decimal; item: { costPrice: Prisma.Decimal | null } }[],
    extraMaterials: MaterialQuantity[],
  ): Promise<number> {
    const lines = procedureMaterials.map((mat) => ({
      quantity: mat.quantity,
      costPrice: mat.item.costPrice,
    }));

    if (extraMaterials.length > 0) {
      const extraInvItems = await tx.inventoryItem.findMany({
        where: { id: { in: extraMaterials.map((m) => m.itemId) } },
      });
      const costById = new Map(extraInvItems.map((i) => [i.id, i.costPrice]));
      for (const mat of extraMaterials) {
        lines.push({ quantity: mat.quantity, costPrice: costById.get(mat.itemId) ?? null });
      }
    }

    return lines.reduce(
      (total, line) =>
        line.costPrice != null ? total + Number(line.quantity) * Number(line.costPrice) : total,
      0,
    );
  }
}
