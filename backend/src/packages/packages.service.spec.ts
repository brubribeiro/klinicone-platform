import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';

import { PackagesService } from './packages.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { PromotionsService } from '../promotions/promotions.service';

describe('PackagesService', () => {
  let service: PackagesService;
  let prisma: any;
  let auditLog: any;
  let promotions: any;

  const mockPackage = {
    id: 'pkg-1',
    name: 'Pacote Botox 3 sessões',
    sessionCount: 3,
    totalPrice: 2000,
    discountPercent: null,
    validityDays: 180,
    items: [
      { procedureId: 'proc-1', quantity: 3, procedure: { price: 800 } },
    ],
    _count: { patientPackages: 2 },
  };

  const mockPatientPackage = {
    id: 'pp-1',
    patientId: 'patient-1',
    packageId: 'pkg-1',
    sessionsTotal: 3,
    sessionsUsed: 1,
    status: 'ACTIVE',
    totalPaid: 2000,
    financeGenerated: false,
  };

  beforeEach(async () => {
    prisma = {
      package: {
        findMany: jest.fn().mockResolvedValue([mockPackage]),
        findUnique: jest.fn().mockResolvedValue(mockPackage),
        create: jest.fn().mockResolvedValue(mockPackage),
        update: jest.fn().mockResolvedValue(mockPackage),
        delete: jest.fn().mockResolvedValue(mockPackage),
      },
      packageItem: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      patientPackage: {
        findMany: jest.fn().mockResolvedValue([mockPatientPackage]),
        findUnique: jest.fn().mockResolvedValue(mockPatientPackage),
        findUniqueOrThrow: jest.fn().mockResolvedValue(mockPatientPackage),
        create: jest.fn().mockResolvedValue(mockPatientPackage),
        update: jest.fn().mockResolvedValue(mockPatientPackage),
        count: jest.fn().mockResolvedValue(0),
      },
      patient: {
        findUnique: jest.fn().mockResolvedValue({ id: 'patient-1', name: 'João' }),
      },
      paymentMethod: {
        findUnique: jest.fn().mockResolvedValue({ id: 'pm-1', name: 'Pix', feePercent: 0 }),
      },
      financialEntry: {
        create: jest.fn().mockResolvedValue({}),
      },
      $transaction: jest.fn().mockImplementation(async (fn) => fn(prisma)),
    };

    promotions = {
      quoteForPackage: jest.fn((_id: string, price: number) =>
        Promise.resolve({ originalPrice: price, discount: 0, finalPrice: price, promotion: null }),
      ),
      discountLabel: jest.fn().mockReturnValue('combo R$ 499.00'),
    };

    auditLog = {
      logCreate: jest.fn().mockResolvedValue(undefined),
      logUpdate: jest.fn().mockResolvedValue(undefined),
      logDelete: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PackagesService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogService, useValue: auditLog },
        { provide: PromotionsService, useValue: promotions },
      ],
    }).compile();

    service = module.get<PackagesService>(PackagesService);
  });

  describe('list', () => {
    it('should return packages with item count', async () => {
      const result = await service.list();
      expect(result).toEqual([mockPackage]);
    });
  });

  describe('findOne', () => {
    it('should throw NotFoundException if not found', async () => {
      prisma.package.findUnique.mockResolvedValue(null);
      await expect(service.findOne('invalid')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should compute sessionCount from items', async () => {
      const dto = {
        name: 'Pacote Novo',
        items: [
          { procedureId: 'proc-1', quantity: 2 },
          { procedureId: 'proc-2', quantity: 1 },
        ],
      };

      await service.create(dto as any);

      expect(prisma.package.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ sessionCount: 3 }),
        }),
      );
    });
  });

  describe('createPatientPackage', () => {
    beforeEach(() => {
      prisma.$transactionWithRetry = jest.fn().mockImplementation(async (fn) => fn(prisma));
    });

    it('applies the active package promotion when no price is given', async () => {
      promotions.quoteForPackage.mockResolvedValue({
        originalPrice: 2000,
        discount: 1501,
        finalPrice: 499,
        promotion: { id: 'promo-1', name: 'Combo Verão', discountType: 'COMBO', discountValue: 499 },
      });

      await service.createPatientPackage({
        patientId: 'patient-1',
        packageId: 'pkg-1',
        paymentMethodId: 'pm-1',
      });

      expect(promotions.quoteForPackage).toHaveBeenCalledWith('pkg-1', 2000, expect.any(Date));
      expect(prisma.patientPackage.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ totalPaid: 499 }) }),
      );
      expect(prisma.financialEntry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            amount: 499,
            description: expect.stringContaining('Promoção: Combo Verão'),
          }),
        }),
      );
    });

    it('keeps a manually agreed price without the promotion label', async () => {
      promotions.quoteForPackage.mockResolvedValue({
        originalPrice: 2000,
        discount: 1501,
        finalPrice: 499,
        promotion: { id: 'promo-1', name: 'Combo Verão', discountType: 'COMBO', discountValue: 499 },
      });

      await service.createPatientPackage({
        patientId: 'patient-1',
        packageId: 'pkg-1',
        totalPaid: 1800,
        paymentMethodId: 'pm-1',
      });

      const entry = prisma.financialEntry.create.mock.calls[0][0].data;
      expect(entry.amount).toBe(1800);
      expect(entry.description).not.toContain('Promoção');
    });
  });

  describe('remove', () => {
    it('should throw if active patient packages exist', async () => {
      prisma.patientPackage.count.mockResolvedValue(2);

      await expect(service.remove('pkg-1')).rejects.toThrow(BadRequestException);
    });

    it('should delete when no active patient packages', async () => {
      await service.remove('pkg-1');
      expect(prisma.package.delete).toHaveBeenCalledWith({ where: { id: 'pkg-1' } });
    });
  });

  describe('incrementSession', () => {
    it('should increment sessionsUsed', async () => {
      await service.incrementSession('pp-1');

      expect(prisma.patientPackage.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ sessionsUsed: 2, status: 'ACTIVE' }),
        }),
      );
    });

    it('should mark as COMPLETED when all sessions used', async () => {
      prisma.patientPackage.findUnique.mockResolvedValue({
        ...mockPatientPackage,
        sessionsUsed: 2,
        sessionsTotal: 3,
      });

      await service.incrementSession('pp-1');

      expect(prisma.patientPackage.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ sessionsUsed: 3, status: 'COMPLETED' }),
        }),
      );
    });
  });

  describe('decrementSession', () => {
    it('should decrement and reactivate if was completed', async () => {
      prisma.patientPackage.findUnique.mockResolvedValue({
        ...mockPatientPackage,
        sessionsUsed: 3,
        status: 'COMPLETED',
      });

      await service.decrementSession('pp-1');

      expect(prisma.patientPackage.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ sessionsUsed: 2, status: 'ACTIVE' }),
        }),
      );
    });

    it('should not decrement below zero', async () => {
      prisma.patientPackage.findUnique.mockResolvedValue({
        ...mockPatientPackage,
        sessionsUsed: 0,
      });

      const result = await service.decrementSession('pp-1');
      expect(prisma.patientPackage.update).not.toHaveBeenCalled();
    });
  });
});
