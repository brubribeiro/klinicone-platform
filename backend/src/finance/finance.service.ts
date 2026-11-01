import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFinancialEntryDto } from './dto/create-financial-entry.dto';
import { UpdateFinancialEntryDto } from './dto/update-financial-entry.dto';
import { parseDateOnlyToUtcNoon } from '../common/utils/date-only.util';
import { AuditLogService, AuditUser } from '../audit-log/audit-log.service';

@Injectable()
export class FinanceService {
  constructor(private readonly prisma: PrismaService, private readonly auditLog: AuditLogService) {}

  /** Inclui lançamentos pagos (paidAt) ou com vencimento (dueDate) no período. */
  private periodWhere(from?: string, to?: string) {
    if (!from && !to) return {};

    const fromDate = from ? new Date(from) : undefined;
    const toDate = to ? new Date(to) : undefined;
    const bounds = {
      ...(fromDate ? { gte: fromDate } : {}),
      ...(toDate ? { lte: toDate } : {}),
    };

    return {
      OR: [{ paidAt: bounds }, { dueDate: bounds }],
    };
  }

  /** Despesas pendentes (paidAt nulo) com vencimento no intervalo — usado na dashboard. */
  async listUpcomingUnpaidExpenses(from?: string, to?: string) {
    const fromDate = from ? new Date(from) : undefined;
    const toDate = to ? new Date(to) : undefined;

    return this.prisma.financialEntry.findMany({
      where: {
        type: 'EXPENSE',
        paidAt: null,
        dueDate: {
          not: null,
          ...(fromDate ? { gte: fromDate } : {}),
          ...(toDate ? { lte: toDate } : {}),
        },
      },
      include: { paymentMethod: true },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async list(from?: string, to?: string, pendingInvoice?: boolean, expenseType?: string, patientId?: string) {
    const entries = await this.prisma.financialEntry.findMany({
      where: {
        ...this.periodWhere(from, to),
        ...(pendingInvoice ? { invoiceIssued: false, type: 'INCOME' } : {}),
        ...(expenseType ? { expenseType: expenseType as any, type: 'EXPENSE' } : {}),
        ...(patientId ? { patientId } : {}),
      },
      include: {
        patient: true,
        appointment: {
          include: { procedure: true },
        },
        paymentMethod: true,
      },
      orderBy: [{ paidAt: 'desc' }, { dueDate: 'desc' }, { createdAt: 'desc' }],
    });

    // Coleta IDs de procedimentos únicos das receitas vinculadas a agendamentos
    const procedureIds = [
      ...new Set(
        entries
          .filter((e) => e.type === 'INCOME' && e.appointment?.procedureId)
          .map((e) => e.appointment!.procedureId!)
      ),
    ];

    // Busca custo base dos procedimentos (soma qty * costPrice dos materiais)
    const costMap = new Map<string, number>();
    if (procedureIds.length > 0) {
      const procedures = await this.prisma.procedure.findMany({
        where: { id: { in: procedureIds } },
        include: { materials: { include: { item: true } } },
      });
      for (const proc of procedures) {
        const cost = (proc.materials ?? []).reduce(
          (sum, m) => sum + Number(m.quantity ?? 0) * Number(m.item?.costPrice ?? 0),
          0,
        );
        if (cost > 0) {
          costMap.set(proc.id, Math.round(cost * 100) / 100);
        }
      }
    }

    // Maior taxa de pagamento ativa (pior cenário para margem)
    const maxFeePayment = await this.prisma.paymentMethod.findFirst({
      where: { active: true },
      orderBy: { feePercent: 'desc' },
    });
    const maxFeePercent = maxFeePayment ? Number(maxFeePayment.feePercent) : 0;

    // Custo/hora: despesas fixas do mês ÷ carga horária mensal da profissional principal
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    const fixedAgg = await this.prisma.financialEntry.aggregate({
      where: {
        type: 'EXPENSE',
        expenseType: 'FIXED',
        OR: [
          { paidAt: { gte: startOfMonth, lte: endOfMonth } },
          { dueDate: { gte: startOfMonth, lte: endOfMonth } },
        ],
      },
      _sum: { amount: true },
    });
    const totalFixed = Number(fixedAgg._sum.amount ?? 0);

    let hourlyCost = 0;
    const mainUser = await this.prisma.user.findFirst({
      where: { isPrimary: true, active: true },
      include: { workingHours: true },
    });
    if (mainUser?.workingHours?.length) {
      const weeklyHours = mainUser.workingHours.reduce((sum, wh) => {
        const [sH, sM] = wh.startTime.split(':').map(Number);
        const [eH, eM] = wh.endTime.split(':').map(Number);
        return sum + Math.max(0, (eH + eM / 60) - (sH + sM / 60));
      }, 0);
      const monthlyHours = weeklyHours * 4.33;
      if (monthlyHours > 0) hourlyCost = totalFixed / monthlyHours;
    }

    // Map procedureId → durationMinutes para calcular fixedShare por procedimento
    const durationMap = new Map<string, number>();
    if (procedureIds.length > 0) {
      const procs = await this.prisma.procedure.findMany({
        where: { id: { in: procedureIds } },
        select: { id: true, durationMinutes: true },
      });
      for (const p of procs) durationMap.set(p.id, p.durationMinutes);
    }

    return entries.map((entry) => {
      const materialCost =
        entry.type === 'INCOME' && entry.appointment?.procedureId
          ? costMap.get(entry.appointment.procedureId) ?? null
          : null;

      let profitMargin: number | null = null;
      if (entry.type === 'INCOME') {
        const price = Number(entry.amount);
        const feeCost = price * (maxFeePercent / 100);
        const matCost = materialCost ?? 0;
        const duration = entry.appointment?.procedureId
          ? durationMap.get(entry.appointment.procedureId) ?? 60
          : 60;
        const fixedShare = hourlyCost * (duration / 60);
        profitMargin = price > 0
          ? Math.round(((price - feeCost - matCost - fixedShare) / price) * 10000) / 100
          : 0;
      }

      return { ...entry, materialCost, profitMargin };
    });
  }

  /** Marca uma nota de serviço como emitida (ou cancela a marcação) */
  async setInvoiceIssued(id: string, issued: boolean) {
    const existing = await this.prisma.financialEntry.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Lançamento não encontrado');
    return this.prisma.financialEntry.update({
      where: { id },
      data: {
        invoiceIssued: issued,
        invoiceIssuedAt: issued ? new Date() : null,
      },
    });
  }

  async summary(from?: string, to?: string) {
    const where = this.periodWhere(from, to);

    const [income, expense, netIncome] = await Promise.all([
      this.prisma.financialEntry.aggregate({
        where: { ...where, type: 'INCOME' },
        _sum: { amount: true },
      }),
      this.prisma.financialEntry.aggregate({
        where: { ...where, type: 'EXPENSE' },
        _sum: { amount: true },
      }),
      this.prisma.financialEntry.aggregate({
        where: { ...where, type: 'INCOME' },
        _sum: { netAmount: true },
      }),
    ]);

    const totalIncome = Number(income._sum.amount ?? 0);
    const totalExpense = Number(expense._sum.amount ?? 0);
    const totalNetIncome = Number(netIncome._sum.netAmount ?? 0) || totalIncome;
    const totalFees = Math.round((totalIncome - totalNetIncome) * 100) / 100;
    return {
      totalIncome,
      totalNetIncome,
      totalFees,
      totalExpense,
      balance: totalIncome - totalExpense,
      netBalance: totalNetIncome - totalExpense,
    };
  }

  async create(dto: CreateFinancialEntryDto, user?: AuditUser) {
    let netAmount: number | undefined;
    let feePercent: number | undefined;

    if (dto.paymentMethodId) {
      const pm = await this.prisma.paymentMethod.findUnique({
        where: { id: dto.paymentMethodId },
      });
      if (pm) {
        feePercent = Number(pm.feePercent);
        netAmount = Math.round(dto.amount * (1 - feePercent / 100) * 100) / 100;
      }
    }

    const created = await this.prisma.financialEntry.create({
      data: {
        type: dto.type,
        description: dto.description,
        amount: dto.amount,
        netAmount,
        feePercent,
        paymentMethodId: dto.paymentMethodId ?? null,
        installments: dto.installments ?? null,
        cardBrand: dto.cardBrand?.trim() || null,
        authorizationCode: dto.authorizationCode?.trim() || null,
        category: dto.category,
        paidAt: parseDateOnlyToUtcNoon(dto.paidAt),
        dueDate: parseDateOnlyToUtcNoon(dto.dueDate),
        patientId: dto.patientId,
        appointmentId: dto.appointmentId,
        equipmentId: dto.equipmentId,
        invoiceIssued: dto.invoiceIssued ?? false,
        expenseType: dto.expenseType,
      },
      include: { paymentMethod: true },
    });
    this.auditLog.logCreate('FinancialEntry', created.id, created as unknown as Record<string, unknown>, user).catch(() => undefined);
    return created;
  }

  async update(id: string, dto: UpdateFinancialEntryDto, user?: AuditUser) {
    const existing = await this.prisma.financialEntry.findUnique({
      where: { id },
      include: { paymentMethod: true, patient: true, equipment: true, recurringExpense: true },
    });
    if (!existing) throw new NotFoundException('Lançamento não encontrado');

    const amount = dto.amount ?? Number(existing.amount);
    let netAmount: number | undefined;
    let feePercent: number | undefined;
    const pmId = dto.paymentMethodId !== undefined ? dto.paymentMethodId : existing.paymentMethodId;

    if (pmId) {
      const pm = await this.prisma.paymentMethod.findUnique({ where: { id: pmId } });
      if (pm) {
        feePercent = Number(pm.feePercent);
        netAmount = Math.round(amount * (1 - feePercent / 100) * 100) / 100;
      }
    }

    const updated = await this.prisma.financialEntry.update({
      where: { id },
      data: {
        type: dto.type,
        description: dto.description,
        amount: dto.amount,
        netAmount,
        feePercent,
        paymentMethodId: dto.paymentMethodId !== undefined ? dto.paymentMethodId ?? null : undefined,
        installments: dto.installments !== undefined ? dto.installments ?? null : undefined,
        cardBrand: dto.cardBrand !== undefined ? dto.cardBrand?.trim() || null : undefined,
        authorizationCode:
          dto.authorizationCode !== undefined ? dto.authorizationCode?.trim() || null : undefined,
        category: dto.category,
        paidAt: parseDateOnlyToUtcNoon(dto.paidAt),
        dueDate: parseDateOnlyToUtcNoon(dto.dueDate),
        patientId: dto.patientId,
        equipmentId: dto.equipmentId,
        invoiceIssued: dto.invoiceIssued,
        expenseType: dto.expenseType,
      },
      include: { paymentMethod: true },
    });
    this.auditLog.logUpdate('FinancialEntry', id, existing as unknown as Record<string, unknown>, updated as unknown as Record<string, unknown>, user).catch(() => undefined);
    return updated;
  }

  async markPaid(id: string, paid: boolean, user?: AuditUser) {
    const existing = await this.prisma.financialEntry.findUnique({
      where: { id },
      include: { paymentMethod: true, patient: true },
    });
    if (!existing) throw new NotFoundException('Lançamento não encontrado');
    const updated = await this.prisma.financialEntry.update({
      where: { id },
      data: { paidAt: paid ? new Date() : null },
      include: { paymentMethod: true },
    });
    this.auditLog.logUpdate('FinancialEntry', id, existing as unknown as Record<string, unknown>, updated as unknown as Record<string, unknown>, user).catch(() => undefined);
    return updated;
  }

  async remove(id: string, user?: AuditUser) {
    const existing = await this.prisma.financialEntry.findUnique({
      where: { id },
      include: { paymentMethod: true, patient: true, equipment: true, recurringExpense: true },
    });
    await this.prisma.financialEntry.delete({ where: { id } });
    if (existing) this.auditLog.logDelete('FinancialEntry', id, existing as unknown as Record<string, unknown>, user).catch(() => undefined);
    return { ok: true };
  }
}
