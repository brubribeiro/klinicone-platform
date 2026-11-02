import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';

import { PromotionsService } from './promotions.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';

describe('PromotionsService', () => {
  let service: PromotionsService;
  let prisma: any;
  let auditLog: any;

  const mockPromo = {
    id: 'promo-1',
    name: 'Black Friday',
    discountType: 'PERCENTAGE',
    discountValue: 20,
    active: true,
    startAt: new Date('2025-11-25'),
    endAt: new Date('2025-11-30'),
    procedures: [],
    packages: [],
    _count: { appointments: 3 },
  };

  beforeEach(async () => {
    prisma = {
      promotion: {
        findMany: jest.fn().mockResolvedValue([mockPromo]),
        findUnique: jest.fn().mockResolvedValue(mockPromo),
        create: jest.fn().mockResolvedValue(mockPromo),
        update: jest.fn().mockResolvedValue(mockPromo),
        delete: jest.fn().mockResolvedValue(mockPromo),
      },
      promotionProcedure: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      promotionPackage: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      $transaction: jest.fn().mockImplementation(async (fn) => fn(prisma)),
    };

    auditLog = {
      logCreate: jest.fn().mockResolvedValue(undefined),
      logUpdate: jest.fn().mockResolvedValue(undefined),
      logDelete: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PromotionsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogService, useValue: auditLog },
      ],
    }).compile();

    service = module.get<PromotionsService>(PromotionsService);
  });

  describe('applyDiscount', () => {
    it('should apply percentage discount', () => {
      const result = service.applyDiscount(800, 'PERCENTAGE' as any, 20);
      expect(result).toBe(640);
    });

    it('should apply fixed discount', () => {
      const result = service.applyDiscount(800, 'FIXED' as any, 150);
      expect(result).toBe(650);
    });

    it('should not go below zero for fixed discount', () => {
      const result = service.applyDiscount(100, 'FIXED' as any, 200);
      expect(result).toBe(0);
    });

    it('should use combo value as final price, never above the full price', () => {
      expect(service.applyDiscount(800, 'COMBO' as any, 499)).toBe(499);
      expect(service.applyDiscount(300, 'COMBO' as any, 499)).toBe(300);
      expect(service.applyDiscount(300, 'COMBO' as any, 0)).toBe(300);
    });
  });

  describe('quoteForProcedure', () => {
    const day = new Date('2025-11-28T12:00:00.000Z');

    it('includes promotions without links (all procedures) except combo', async () => {
      prisma.promotion.findMany.mockResolvedValue([]);
      await service.quoteForProcedure('proc-1', 200, day);
      const where = prisma.promotion.findMany.mock.calls[0][0].where;
      expect(where).toMatchObject({ active: true, startAt: { lte: day }, endAt: { gte: day } });
      expect(where.OR).toEqual([
        { procedures: { some: { procedureId: 'proc-1' } } },
        { procedures: { none: {} }, packages: { none: {} }, discountType: { not: 'COMBO' } },
      ]);
    });

    it('picks the promotion with the lowest final price', async () => {
      prisma.promotion.findMany.mockResolvedValue([
        { id: 'p', name: '20%', discountType: 'PERCENTAGE', discountValue: 20 },
        { id: 'f', name: 'R$ 50', discountType: 'FIXED', discountValue: 50 },
      ]);
      const result = await service.quoteForProcedure('proc-1', 200, day);
      expect(result).toEqual({
        originalPrice: 200,
        discount: 50,
        finalPrice: 150,
        promotion: { id: 'f', name: 'R$ 50', discountType: 'FIXED', discountValue: 50 },
      });
    });

    it('returns the full price when no promotion is active', async () => {
      prisma.promotion.findMany.mockResolvedValue([]);
      const result = await service.quoteForProcedure('proc-1', 200, day);
      expect(result).toEqual({ originalPrice: 200, discount: 0, finalPrice: 200, promotion: null });
    });
  });

  describe('quoteForPackage', () => {
    it('only uses promotions linked to the package and applies combo price', async () => {
      prisma.promotion.findMany.mockResolvedValue([
        { id: 'c', name: 'Combo', discountType: 'COMBO', discountValue: 499 },
      ]);
      const result = await service.quoteForPackage('pkg-1', 800, new Date());
      expect(prisma.promotion.findMany.mock.calls[0][0].where.packages).toEqual({
        some: { packageId: 'pkg-1' },
      });
      expect(result.finalPrice).toBe(499);
      expect(result.discount).toBe(301);
    });
  });

  describe('combo rules', () => {
    const base = {
      name: 'Combo',
      startAt: '2025-11-25',
      endAt: '2025-11-30',
      discountType: 'COMBO' as any,
      discountValue: 499,
    };

    it('rejects combo without specific procedures or packages', async () => {
      await expect(service.create({ ...base })).rejects.toThrow(BadRequestException);
    });

    it('rejects combo without price', async () => {
      await expect(
        service.create({ ...base, discountValue: 0, packageIds: ['pkg-1'] }),
      ).rejects.toThrow(BadRequestException);
    });

    it('accepts combo linked to a package', async () => {
      await service.create({ ...base, packageIds: ['pkg-1'] });
      expect(prisma.promotion.create).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should throw NotFoundException if not found', async () => {
      prisma.promotion.findUnique.mockResolvedValue(null);
      await expect(service.findOne('invalid')).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should throw NotFoundException if not found', async () => {
      prisma.promotion.findUnique.mockResolvedValue(null);
      await expect(service.remove('invalid')).rejects.toThrow(NotFoundException);
    });

    it('should delete promotion', async () => {
      await service.remove('promo-1');
      expect(prisma.promotion.delete).toHaveBeenCalledWith({ where: { id: 'promo-1' } });
    });
  });
});
