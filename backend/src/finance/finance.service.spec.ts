import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';

import { FinanceService } from './finance.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';

describe('FinanceService', () => {
  let service: FinanceService;
  let prisma: any;
  let auditLog: any;

  const mockEntry = {
    id: 'entry-1',
    type: 'INCOME',
    description: 'Botox - João',
    amount: 500,
    netAmount: 485,
    feePercent: 3,
    category: 'Atendimentos',
    paidAt: new Date(),
    paymentMethod: { id: 'pm-1', name: 'Cartão', feePercent: 3 },
  };

  beforeEach(async () => {
    prisma = {
      financialEntry: {
        findMany: jest.fn().mockResolvedValue([mockEntry]),
        findUnique: jest.fn().mockResolvedValue(mockEntry),
        create: jest.fn().mockResolvedValue(mockEntry),
        update: jest.fn().mockResolvedValue(mockEntry),
        delete: jest.fn().mockResolvedValue(mockEntry),
        aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 1000, netAmount: 970 } }),
      },
      procedure: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      paymentMethod: {
        findFirst: jest.fn().mockResolvedValue({ feePercent: 5 }),
        findUnique: jest.fn().mockResolvedValue({ id: 'pm-1', feePercent: 3 }),
      },
      user: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };

    auditLog = {
      logCreate: jest.fn().mockResolvedValue(undefined),
      logUpdate: jest.fn().mockResolvedValue(undefined),
      logDelete: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FinanceService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogService, useValue: auditLog },
      ],
    }).compile();

    service = module.get<FinanceService>(FinanceService);
  });

  describe('listUpcomingUnpaidExpenses', () => {
    it('should list only unpaid expenses with dueDate in range', async () => {
      await service.listUpcomingUnpaidExpenses('2026-01-01', '2026-01-31');

      expect(prisma.financialEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            type: 'EXPENSE',
            paidAt: null,
            dueDate: expect.objectContaining({
              not: null,
              gte: expect.any(Date),
              lte: expect.any(Date),
            }),
          }),
          orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
        }),
      );
    });
  });

  describe('list', () => {
    it('attributes material cost to the procedure of each income of a multi-procedure booking', async () => {
      const appointment = {
        procedureId: 'proc-1',
        procedure: { id: 'proc-1', name: 'Limpeza' },
        appointmentProcedures: [
          { procedure: { id: 'proc-1', name: 'Limpeza' } },
          { procedure: { id: 'proc-2', name: 'Peeling' } },
        ],
      };
      const income = (id: string, description: string, amount: number) => ({
        ...mockEntry,
        id,
        description,
        amount,
        appointment,
      });
      prisma.financialEntry.findMany.mockResolvedValue([
        income('e-1', 'Limpeza - Ana', 200),
        income('e-2', 'Peeling - Ana', 300),
        income('e-3', 'Pacote - Limpeza + Peeling - Ana', 900),
      ]);
      prisma.procedure.findMany.mockResolvedValue([
        { id: 'proc-1', durationMinutes: 60, materials: [{ quantity: 2, item: { costPrice: 10 } }] },
        { id: 'proc-2', durationMinutes: 30, materials: [{ quantity: 1, item: { costPrice: 50 } }] },
      ]);

      const result = await service.list();

      expect(result.map((e) => [e.id, e.materialCost])).toEqual([
        ['e-1', 20],
        ['e-2', 50],
        ['e-3', 70],
      ]);
    });
  });

  describe('summary', () => {
    it('should compute balance from income and expense', async () => {
      prisma.financialEntry.aggregate
        .mockResolvedValueOnce({ _sum: { amount: 5000 } })    // income
        .mockResolvedValueOnce({ _sum: { amount: 2000 } })    // expense
        .mockResolvedValueOnce({ _sum: { netAmount: 4850 } }); // netIncome

      const result = await service.summary();

      expect(result.totalIncome).toBe(5000);
      expect(result.totalExpense).toBe(2000);
      expect(result.balance).toBe(3000);
      expect(result.totalNetIncome).toBe(4850);
      expect(result.netBalance).toBe(2850);
    });
  });

  describe('create', () => {
    it('should calculate netAmount when paymentMethod has fee', async () => {
      await service.create({
        type: 'INCOME',
        description: 'Test',
        amount: 100,
        category: 'Atendimentos',
        paymentMethodId: 'pm-1',
      } as any);

      expect(prisma.financialEntry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            netAmount: 97, // 100 * (1 - 3/100)
            feePercent: 3,
          }),
        }),
      );
    });

    it('should create entry without netAmount when no paymentMethod', async () => {
      await service.create({
        type: 'EXPENSE',
        description: 'Aluguel',
        amount: 3000,
        category: 'Fixas',
      } as any);

      expect(prisma.financialEntry.create).toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('should throw NotFoundException for invalid id', async () => {
      prisma.financialEntry.findUnique.mockResolvedValue(null);

      await expect(service.update('invalid', {} as any)).rejects.toThrow(NotFoundException);
    });

    it('should recalculate netAmount on amount change with existing payment method', async () => {
      prisma.financialEntry.findUnique.mockResolvedValue({
        ...mockEntry,
        paymentMethodId: 'pm-1',
      });

      await service.update('entry-1', { amount: 200 } as any);

      expect(prisma.financialEntry.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            netAmount: 194, // 200 * (1 - 3/100)
          }),
        }),
      );
    });
  });

  describe('setInvoiceIssued', () => {
    it('should throw if entry not found', async () => {
      prisma.financialEntry.findUnique.mockResolvedValue(null);
      await expect(service.setInvoiceIssued('invalid', true)).rejects.toThrow(NotFoundException);
    });

    it('should set invoiceIssued and invoiceIssuedAt', async () => {
      await service.setInvoiceIssued('entry-1', true);

      expect(prisma.financialEntry.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            invoiceIssued: true,
          }),
        }),
      );
    });
  });

  describe('markPaid', () => {
    it('should set paidAt when marking as paid', async () => {
      await service.markPaid('entry-1', true);
      expect(prisma.financialEntry.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ paidAt: expect.any(Date) }),
        }),
      );
    });

    it('should set paidAt to null when unmarking', async () => {
      await service.markPaid('entry-1', false);
      expect(prisma.financialEntry.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ paidAt: null }),
        }),
      );
    });
  });

  describe('remove', () => {
    it('should delete entry', async () => {
      await service.remove('entry-1');
      expect(prisma.financialEntry.delete).toHaveBeenCalledWith({ where: { id: 'entry-1' } });
    });
  });
});
