import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService, AuditUser } from '../audit-log/audit-log.service';
import { assertDeletable, dependency } from '../common/deletion/deletion-dependencies';
import {
  computeHourlyCostSummary,
  getHourlyCostIncludeVariable,
  setHourlyCostIncludeVariable,
} from '../common/utils/hourly-cost.util';
import { CreateRecurringExpenseDto } from './dto/create-recurring-expense.dto';
import { UpdateRecurringExpenseDto } from './dto/update-recurring-expense.dto';

@Injectable()
export class RecurringExpensesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  list() {
    return this.prisma.recurringExpense.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { generatedEntries: true } } },
    });
  }

  getHourlyCostSettings() {
    return getHourlyCostIncludeVariable(this.prisma).then((includeVariable) => ({
      includeVariable,
    }));
  }

  setHourlyCostSettings(includeVariable: boolean) {
    return setHourlyCostIncludeVariable(this.prisma, includeVariable);
  }

  async getHourlyCostSummary(includeVariable?: boolean) {
    const include =
      includeVariable ?? (await getHourlyCostIncludeVariable(this.prisma));
    return computeHourlyCostSummary(this.prisma, {
      useRecurringCatalog: true,
      includeVariable: include,
    });
  }

  async findOne(id: string) {
    const item = await this.prisma.recurringExpense.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Despesa recorrente não encontrada');
    return item;
  }

  async create(dto: CreateRecurringExpenseDto, user?: AuditUser) {
    const created = await this.prisma.recurringExpense.create({
      data: {
        name: dto.name,
        description: dto.description,
        amount: dto.amount,
        category: dto.category,
        expenseType: dto.expenseType,
        dueDay: dto.dueDay,
        active: dto.active ?? true,
      },
    });
    this.auditLog.logCreate('RecurringExpense', created.id, created as unknown as Record<string, unknown>, user).catch(() => undefined);
    return created;
  }

  async update(id: string, dto: UpdateRecurringExpenseDto, user?: AuditUser) {
    const oldData = await this.findOne(id);
    const updated = await this.prisma.recurringExpense.update({
      where: { id },
      data: dto,
    });
    this.auditLog.logUpdate('RecurringExpense', id, oldData as unknown as Record<string, unknown>, updated as unknown as Record<string, unknown>, user).catch(() => undefined);
    return updated;
  }

  async remove(id: string, user?: AuditUser, unlink = false) {
    const old = await this.findOne(id);
    const unlinked = await this.prisma.$transactionWithRetry(async (tx) => {
      const entryCount = await tx.financialEntry.count({ where: { recurringExpenseId: id } });
      const deps = assertDeletable(
        `a despesa recorrente "${old.name}"`,
        [
          dependency({
            type: 'financialEntries',
            label: 'Lançamentos financeiros gerados',
            count: entryCount,
            unlinkable: true,
            note: 'Os lançamentos já gerados continuam no financeiro.',
          }),
        ],
        { unlink },
      );
      await tx.financialEntry.updateMany({
        where: { recurringExpenseId: id },
        data: { recurringExpenseId: null },
      });
      await tx.recurringExpense.delete({ where: { id } });
      return deps;
    });
    this.auditLog
      .logDelete('RecurringExpense', id, { ...old, unlinkedDependencies: unlinked } as unknown as Record<string, unknown>, user)
      .catch(() => undefined);
    return { ok: true, unlinked };
  }


  async generateForMonth(year: number, month: number) {
    const actives = await this.prisma.recurringExpense.findMany({
      where: { active: true },
    });

    const created: string[] = [];

    for (const re of actives) {
      const lastDayOfMonth = new Date(year, month, 0).getDate();
      const day = Math.min(re.dueDay, lastDayOfMonth);
      const dueDate = new Date(year, month - 1, day);

      const monthStart = new Date(year, month - 1, 1);
      const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);

      const existing = await this.prisma.financialEntry.findFirst({
        where: {
          recurringExpenseId: re.id,
          dueDate: { gte: monthStart, lte: monthEnd },
        },
      });

      if (existing) continue;

      await this.prisma.financialEntry.create({
        data: {
          type: 'EXPENSE',
          description: re.name,
          amount: re.amount,
          category: re.category,
          expenseType: re.expenseType,
          dueDate,
          recurringExpenseId: re.id,
        },
      });

      created.push(re.name);
    }

    return {
      generated: created.length,
      items: created,
      month: `${year}-${String(month).padStart(2, '0')}`,
    };
  }
}
