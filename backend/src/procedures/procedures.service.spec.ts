import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';

import { ProceduresService } from './procedures.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { DeletionConflictException } from '../common/deletion/deletion-dependencies';

jest.mock('../common/utils/hourly-cost.util', () => ({
  getHourlyCostIncludeVariable: jest.fn().mockResolvedValue(false),
  computeHourlyCostSummary: jest.fn().mockResolvedValue({ hourlyCost: 50 }),
}));

describe('ProceduresService', () => {
  let service: ProceduresService;
  let prisma: any;
  let auditLog: any;

  const mockProcedure = {
    id: 'proc-1',
    name: 'Botox Full Face',
    price: 800,
    durationMinutes: 60,
    recurrenceDays: 120,
    materials: [
      { item: { costPrice: 250 }, quantity: 1 },
    ],
    equipments: [],
  };

  beforeEach(async () => {
    prisma = {
      procedure: {
        findMany: jest.fn().mockResolvedValue([mockProcedure]),
        findUnique: jest.fn().mockResolvedValue(mockProcedure),
        create: jest.fn().mockResolvedValue(mockProcedure),
        update: jest.fn().mockResolvedValue(mockProcedure),
        delete: jest.fn().mockResolvedValue(mockProcedure),
      },
      procedureMaterial: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      appointment: {
        groupBy: jest.fn().mockResolvedValue([]),
      },
      paymentMethod: {
        findFirst: jest.fn().mockResolvedValue({ feePercent: 5 }),
      },
      $transaction: jest.fn().mockImplementation(async (fn) => fn(prisma)),
      $transactionWithRetry: jest.fn().mockImplementation(async (fn) => fn(prisma)),
    };

    auditLog = {
      logCreate: jest.fn().mockResolvedValue(undefined),
      logUpdate: jest.fn().mockResolvedValue(undefined),
      logDelete: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProceduresService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogService, useValue: auditLog },
      ],
    }).compile();

    service = module.get<ProceduresService>(ProceduresService);
  });

  describe('list', () => {
    it('should return procedures with computed financials', async () => {
      const result = await service.list();

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('baseCost');
      expect(result[0]).toHaveProperty('profitMargin');
      expect(result[0]).toHaveProperty('appointmentsCount', 0);
      expect(result[0].baseCost).toBe(250); // 250 * 1
      expect(prisma.appointment.groupBy).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should throw NotFoundException if not found', async () => {
      prisma.procedure.findUnique.mockResolvedValue(null);
      await expect(service.findOne('invalid')).rejects.toThrow(NotFoundException);
    });

    it('should return procedure with financials', async () => {
      const result = await service.findOne('proc-1');

      expect(result.name).toBe('Botox Full Face');
      expect(result.baseCost).toBe(250);
      expect(result.maxFeePercent).toBe(5);
    });
  });

  describe('create', () => {
    it('should create procedure with materials', async () => {
      const dto = {
        name: 'Botox Full Face',
        price: 800,
        durationMinutes: 60,
        materials: [{ itemId: 'item-1', quantity: 1 }],
      };

      const result = await service.create(dto as any);

      expect(prisma.procedure.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'Botox Full Face',
          }),
        }),
      );
    });
  });

  describe('update', () => {
    it('should replace materials when provided', async () => {
      const dto = {
        price: 900,
        materials: [{ itemId: 'item-2', quantity: 2 }],
      };

      await service.update('proc-1', dto as any);

      expect(prisma.procedureMaterial.deleteMany).toHaveBeenCalledWith({
        where: { procedureId: 'proc-1' },
      });
      expect(prisma.procedureMaterial.createMany).toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    const conflictOf = async (promise: Promise<unknown>) => {
      const err = await promise.catch((e) => e);
      expect(err).toBeInstanceOf(DeletionConflictException);
      return (err as DeletionConflictException).getResponse() as Record<string, any>;
    };

    beforeEach(() => {
      prisma.appointment.count = jest.fn().mockResolvedValue(0);
      prisma.packageItem = {
        findMany: jest.fn().mockResolvedValue([]),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      };
      prisma.promotionProcedure = {
        findMany: jest.fn().mockResolvedValue([]),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      };
      prisma.messageTemplate = {
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      };
    });

    const withUnlinkables = () => {
      prisma.packageItem.findMany.mockResolvedValue([{ package: { name: 'Pacote A' } }]);
      prisma.promotionProcedure.findMany.mockResolvedValue([{ promotion: { name: 'Promo B' } }]);
      prisma.messageTemplate.findMany.mockResolvedValue([{ name: 'Modelo C' }]);
    };

    it('responde 409 com canUnlink true listando pacotes, promoções e modelos', async () => {
      withUnlinkables();
      const body = await conflictOf(service.remove('proc-1'));
      expect(body.canUnlink).toBe(true);
      expect(body.dependencies).toEqual([
        expect.objectContaining({ type: 'packages', names: ['Pacote A'] }),
        expect.objectContaining({ type: 'promotions', names: ['Promo B'] }),
        expect.objectContaining({ type: 'messageTemplates', names: ['Modelo C'] }),
      ]);
      expect(prisma.procedure.delete).not.toHaveBeenCalled();
    });

    it('bloqueia (canUnlink false) quando há atendimentos, mesmo desvinculando', async () => {
      withUnlinkables();
      prisma.appointment.count.mockResolvedValue(4);
      const body = await conflictOf(service.remove('proc-1', undefined, true));
      expect(body.canUnlink).toBe(false);
      expect(body.message).toContain('Atendimentos (4)');
      expect(prisma.packageItem.deleteMany).not.toHaveBeenCalled();
      expect(prisma.promotionProcedure.deleteMany).not.toHaveBeenCalled();
      expect(prisma.messageTemplate.updateMany).not.toHaveBeenCalled();
      expect(prisma.procedure.delete).not.toHaveBeenCalled();
    });

    it('desvincula pacotes, promoções e modelos e exclui', async () => {
      withUnlinkables();
      const result = await service.remove('proc-1', { id: 'u1' } as never, true);
      expect(result.ok).toBe(true);
      expect(result.unlinked.map((d) => d.type)).toEqual(['packages', 'promotions', 'messageTemplates']);
      expect(prisma.packageItem.deleteMany).toHaveBeenCalledWith({ where: { procedureId: 'proc-1' } });
      expect(prisma.promotionProcedure.deleteMany).toHaveBeenCalledWith({ where: { procedureId: 'proc-1' } });
      expect(prisma.messageTemplate.updateMany).toHaveBeenCalledWith({
        where: { procedureId: 'proc-1' },
        data: { procedureId: null },
      });
      expect(prisma.procedure.delete).toHaveBeenCalledWith({ where: { id: 'proc-1' } });
      expect(auditLog.logDelete).toHaveBeenCalledWith(
        'Procedure',
        'proc-1',
        expect.objectContaining({ unlinkedDependencies: expect.any(Array) }),
        expect.anything(),
      );
    });

    it('exclui direto quando não há vínculos', async () => {
      await expect(service.remove('proc-1')).resolves.toEqual({ ok: true, unlinked: [] });
      expect(prisma.procedure.delete).toHaveBeenCalledWith({ where: { id: 'proc-1' } });
    });
  });

  describe('computeFinancials', () => {
    it('should compute profit margin correctly', async () => {
      // Access via list which calls computeFinancials internally
      const result = await service.list();

      // price=800, baseCost=250, maxFeeCost=800*5%=40, fixedCostShare=50*1=50
      // totalCost = 250+40+50 = 340
      // profitMargin = (800-340)/800 * 100 = 57.5%
      expect(result[0].profitMargin).toBe(57.5);
    });
  });
});
