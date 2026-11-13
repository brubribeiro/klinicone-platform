import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';

import { InventoryService } from './inventory.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditLogService } from '../audit-log/audit-log.service';

describe('InventoryService', () => {
  let service: InventoryService;
  let prisma: any;
  let notifications: any;
  let auditLog: any;

  const mockItem = {
    id: 'item-1',
    name: 'Botox 100U',
    quantity: 10,
    minQuantity: 5,
    unit: 'un',
    costPrice: 250,
    movements: [],
  };

  beforeEach(async () => {
    prisma = {
      inventoryItem: {
        findMany: jest.fn().mockResolvedValue([mockItem]),
        findUnique: jest.fn().mockResolvedValue(mockItem),
        create: jest.fn().mockResolvedValue(mockItem),
        update: jest.fn().mockResolvedValue(mockItem),
        delete: jest.fn().mockResolvedValue(mockItem),
      },
      inventoryMovement: {
        create: jest.fn().mockResolvedValue({ id: 'mov-1' }),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        count: jest.fn().mockResolvedValue(3),
      },
      procedureMaterial: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      appointmentMaterial: {
        count: jest.fn().mockResolvedValue(0),
      },
      financialEntry: {
        create: jest.fn().mockResolvedValue({}),
      },
      $transaction: jest.fn().mockImplementation(async (fn) => {
        if (typeof fn === 'function') {
          return fn(prisma);
        }
        // Array transaction
        return fn;
      }),
      $transactionWithRetry: jest.fn().mockImplementation(async (fn) => fn(prisma)),
    };

    notifications = {
      findUsersWithPermission: jest.fn().mockResolvedValue([]),
      notifyMany: jest.fn().mockResolvedValue(undefined),
    };

    auditLog = {
      logCreate: jest.fn().mockResolvedValue(undefined),
      logUpdate: jest.fn().mockResolvedValue(undefined),
      logDelete: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationsService, useValue: notifications },
        { provide: AuditLogService, useValue: auditLog },
      ],
    }).compile();

    service = module.get<InventoryService>(InventoryService);
  });

  describe('list', () => {
    it('should return items ordered by name', async () => {
      const result = await service.list();
      expect(result).toEqual([mockItem]);
      expect(prisma.inventoryItem.findMany).toHaveBeenCalledWith({ orderBy: { name: 'asc' } });
    });
  });

  describe('listLowStock', () => {
    it('should filter items at or below min quantity', async () => {
      prisma.inventoryItem.findMany.mockResolvedValue([
        { ...mockItem, quantity: 5, minQuantity: 5 },
        { ...mockItem, id: 'item-2', quantity: 20, minQuantity: 5 },
      ]);

      const result = await service.listLowStock();
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('item-1');
    });
  });

  describe('findOne', () => {
    it('should throw NotFoundException if not found', async () => {
      prisma.inventoryItem.findUnique.mockResolvedValue(null);
      await expect(service.findOne('invalid')).rejects.toThrow(NotFoundException);
    });

    it('should return item with movements', async () => {
      const result = await service.findOne('item-1');
      expect(result).toEqual(mockItem);
    });
  });

  describe('create', () => {
    it('should create inventory item', async () => {
      const dto = { name: 'Botox 100U', minQuantity: 5, unit: 'un' };
      const result = await service.create(dto as any);
      expect(prisma.inventoryItem.create).toHaveBeenCalledWith({ data: dto });
    });
  });

  describe('getDeletionPreview', () => {
    it('should allow deletion when item has no procedure/appointment usages', async () => {
      const result = await service.getDeletionPreview('item-1');
      expect(result.canDelete).toBe(true);
      expect(result.procedures).toEqual([]);
    });

    it('should prevent deletion when item is used in procedures', async () => {
      prisma.procedureMaterial.findMany.mockResolvedValue([
        { procedure: { id: 'proc-1', name: 'Botox Full' } },
      ]);

      const result = await service.getDeletionPreview('item-1');
      expect(result.canDelete).toBe(false);
      expect(result.procedures).toHaveLength(1);
    });
  });

  describe('remove', () => {
    it('should throw BadRequestException if cannot delete', async () => {
      prisma.procedureMaterial.findMany.mockResolvedValue([
        { procedure: { id: 'proc-1', name: 'Botox Full' } },
      ]);

      await expect(service.remove('item-1')).rejects.toThrow(BadRequestException);
    });

    it('should delete the item and its movements when unused', async () => {
      prisma.inventoryItem.findUnique.mockResolvedValue(mockItem);
      prisma.inventoryMovement.deleteMany = jest.fn().mockResolvedValue({ count: 2 });
      prisma.inventoryItem.delete = jest.fn().mockResolvedValue(mockItem);

      await expect(service.remove('item-1')).resolves.toEqual({ ok: true });
      expect(prisma.inventoryMovement.deleteMany).toHaveBeenCalledWith({ where: { itemId: 'item-1' } });
      expect(prisma.inventoryItem.delete).toHaveBeenCalledWith({ where: { id: 'item-1' } });
    });
  });

  describe('createMovement', () => {
    it('should throw for OUT movement exceeding stock', async () => {
      prisma.inventoryItem.findUnique.mockResolvedValue({ ...mockItem, quantity: 2 });

      await expect(
        service.createMovement('item-1', {
          type: 'OUT',
          quantity: 5,
          reason: 'Uso',
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw if IN movement has no totalPrice', async () => {
      await expect(
        service.createMovement('item-1', {
          type: 'IN',
          quantity: 5,
          reason: 'Compra',
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create IN movement and generate financial entry', async () => {
      const [movement] = await service.createMovement('item-1', {
        type: 'IN',
        quantity: 5,
        reason: 'Compra',
        totalPrice: 1250,
      } as any);

      expect(prisma.inventoryMovement.create).toHaveBeenCalled();
      expect(prisma.inventoryItem.update).toHaveBeenCalled();
      expect(prisma.financialEntry.create).toHaveBeenCalled();
    });

    it('ajuste para 0 zera o estoque do item', async () => {
      prisma.inventoryItem.findUnique.mockResolvedValue({ ...mockItem, quantity: 7 });

      await service.createMovement('item-1', { type: 'ADJUSTMENT', quantity: 0, reason: 'Inventário' } as any);

      // grava a diferença: 7 - 7 = 0
      expect(prisma.inventoryItem.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { quantity: { increment: -7 } } }),
      );
    });

    it('entrada ou saída com quantidade 0 é recusada', async () => {
      for (const type of ['IN', 'OUT'] as const) {
        await expect(
          service.createMovement('item-1', { type, quantity: 0, totalPrice: 10 } as any),
        ).rejects.toThrow('maior que zero');
      }
    });

    it('should notify when stock drops below minimum', async () => {
      prisma.inventoryItem.findUnique.mockResolvedValue({ ...mockItem, quantity: 6, minQuantity: 5 });
      notifications.findUsersWithPermission.mockResolvedValue([{ id: 'admin-1' }]);

      await service.createMovement('item-1', {
        type: 'OUT',
        quantity: 2,
        reason: 'Uso',
      } as any);

      expect(notifications.notifyMany).toHaveBeenCalled();
    });
  });
});
