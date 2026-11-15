import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { MovementType, NotificationType, FinancialType, ExpenseType } from '@prisma/client';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { CreateInventoryItemDto } from './dto/create-inventory-item.dto';
import { UpdateInventoryItemDto } from './dto/update-inventory-item.dto';
import { CreateMovementDto } from './dto/create-movement.dto';
import { BulkPurchaseDto } from './dto/bulk-purchase.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { parseDateOnlyToUtcNoon } from '../common/utils/date-only.util';
import { AuditLogService, AuditUser } from '../audit-log/audit-log.service';
import { assertDeletable, dependency } from '../common/deletion/deletion-dependencies';

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly auditLog: AuditLogService,
  ) {}

  list() {
    return this.prisma.inventoryItem.findMany({ orderBy: { name: 'asc' } });
  }

  /** Itens com estoque <= mínimo, para alerta/export */
  async listLowStock() {
    const all = await this.prisma.inventoryItem.findMany({ orderBy: { name: 'asc' } });
    return all.filter((i) => Number(i.quantity) <= Number(i.minQuantity));
  }

  async findOne(id: string) {
    const item = await this.prisma.inventoryItem.findUnique({
      where: { id },
      include: { movements: { orderBy: { createdAt: 'desc' } } },
    });
    if (!item) throw new NotFoundException('Item não encontrado');
    return item;
  }

  async create(dto: CreateInventoryItemDto, user?: AuditUser) {
    const created = await this.prisma.inventoryItem.create({ data: dto });
    this.auditLog.logCreate('InventoryItem', created.id, created as unknown as Record<string, unknown>, user).catch(() => undefined);
    return created;
  }

  async update(id: string, dto: UpdateInventoryItemDto, user?: AuditUser) {
    const oldData = await this.findOne(id);
    const updated = await this.prisma.inventoryItem.update({ where: { id }, data: dto });
    this.auditLog.logUpdate('InventoryItem', id, oldData as unknown as Record<string, unknown>, updated as unknown as Record<string, unknown>, user).catch(() => undefined);
    return updated;
  }

  /** Vínculos que impedem ou exigem desvincular antes de excluir o item. */
  private async collectDeletionDependencies(tx: Prisma.TransactionClient, id: string) {
    const [procedureUsages, appointmentCount, movementsCount] = await Promise.all([
      tx.procedureMaterial.findMany({
        where: { itemId: id },
        select: { procedure: { select: { id: true, name: true } } },
      }),
      tx.appointmentMaterial.count({ where: { itemId: id } }),
      tx.inventoryMovement.count({ where: { itemId: id } }),
    ]);
    const procedures = new Map(procedureUsages.map((u) => [u.procedure.id, u.procedure.name]));
    return [
      dependency({
        type: 'procedures',
        label: 'Procedimentos',
        count: procedures.size,
        names: [...procedures.values()],
        unlinkable: true,
        note: 'O item sai da lista de materiais desses procedimentos.',
      }),
      dependency({
        type: 'appointments',
        label: 'Atendimentos',
        count: appointmentCount,
        unlinkable: false,
        note: 'O consumo do item em atendimentos faz parte do histórico e não pode ser desvinculado.',
      }),
      dependency({
        type: 'movements',
        label: 'Movimentações de estoque',
        count: movementsCount,
        unlinkable: true,
        note: 'As movimentações continuam no histórico com o nome do item.',
      }),
    ];
  }

  async remove(id: string, user?: AuditUser, unlink = false) {
    const oldData = await this.prisma.inventoryItem.findUnique({ where: { id } });
    if (!oldData) throw new NotFoundException('Item não encontrado');

    const unlinked = await this.prisma.$transactionWithRetry(async (tx) => {
      const deps = assertDeletable(
        `o item "${oldData.name}"`,
        await this.collectDeletionDependencies(tx, id),
        { unlink },
      );
      await tx.procedureMaterial.deleteMany({ where: { itemId: id } });
      await tx.inventoryMovement.updateMany({
        where: { itemId: id },
        data: { itemId: null, itemName: oldData.name },
      });
      await tx.inventoryItem.delete({ where: { id } });
      return deps;
    });

    this.auditLog
      .logDelete('InventoryItem', id, { ...oldData, unlinkedDependencies: unlinked } as unknown as Record<string, unknown>, user)
      .catch(() => undefined);

    return { ok: true, unlinked };
  }

  async createMovement(itemId: string, dto: CreateMovementDto, user?: AuditUser) {
    const item = await this.findOne(itemId);

    const currentQty = Number(item.quantity);
    if (dto.type !== MovementType.ADJUSTMENT && !(dto.quantity > 0)) {
      throw new BadRequestException('Informe uma quantidade maior que zero.');
    }

    let delta = 0;
    if (dto.type === MovementType.IN) delta = dto.quantity;
    else if (dto.type === MovementType.OUT) delta = -dto.quantity;
    else if (dto.type === MovementType.ADJUSTMENT) delta = dto.quantity - currentQty;

    if (currentQty + delta < 0) {
      throw new BadRequestException('Estoque insuficiente para essa saída.');
    }

    const newQuantity = currentQty + delta;

    // Dados da movimentação — inclui validade do lote quando informada
    const movementData: any = {
      itemId,
      type: dto.type,
      quantity: dto.quantity,
      reason: dto.reason,
      expiresAt: parseDateOnlyToUtcNoon(dto.expiresAt),
    };

    // Se for entrada, atualiza validade e custo unitário do item (calculado a partir do total)
    const itemUpdate: Prisma.InventoryItemUpdateInput = { quantity: { increment: delta } };
    let unitPrice: number | null = null;

    if (dto.type === MovementType.IN) {
      if (dto.expiresAt) {
        itemUpdate.expiresAt = parseDateOnlyToUtcNoon(dto.expiresAt);
      }

      if (dto.totalPrice == null || dto.totalPrice <= 0) {
        throw new BadRequestException('Informe o valor total da compra para entradas de estoque.');
      }

      unitPrice = dto.totalPrice / dto.quantity;
      itemUpdate.costPrice = new Prisma.Decimal(Math.round(unitPrice * 100) / 100);
    }

    const result = await this.prisma.$transactionWithRetry(async (tx) => {
      const movement = await tx.inventoryMovement.create({
        data: movementData,
        include: { item: { select: { id: true, name: true } } },
      });
      const updatedItem = await tx.inventoryItem.update({ where: { id: itemId }, data: itemUpdate });

      // Entrada de estoque gera despesa no financeiro
      if (dto.type === MovementType.IN && dto.totalPrice != null && dto.totalPrice > 0) {
        const roundedUnit = unitPrice != null ? Math.round(unitPrice * 100) / 100 : 0;
        await tx.financialEntry.create({
          data: {
            type: FinancialType.EXPENSE,
            description: `Compra de estoque - ${item.name} (${dto.quantity} ${item.unit ?? 'un'} · total ${dto.totalPrice.toFixed(2)} · unit. ${roundedUnit.toFixed(2)})`,
            amount: new Prisma.Decimal(Math.round(dto.totalPrice * 100) / 100),
            category: 'Investimento em estoque',
            expenseType: ExpenseType.VARIABLE,
            paidAt: new Date(),
            invoiceIssued: false,
          },
        });
      }

      return [movement, updatedItem] as const;
    });

    this.auditLog.logCreate('InventoryMovement', result[0].id, result[0] as unknown as Record<string, unknown>, user).catch(() => undefined);

    // Se a movimentação fez o estoque cruzar o mínimo, notifica quem pode editar estoque
    const minQty = Number(item.minQuantity);
    if (newQuantity <= minQty && currentQty > minQty) {
      const recipients = await this.notifications.findUsersWithPermission('inventory:edit');
      this.notifications
        .notifyMany(
          recipients.map((u) => u.id),
          {
            type: NotificationType.INVENTORY_LOW_STOCK,
            title: 'Estoque baixo',
            message: `${item.name}: ${newQuantity} ${item.unit ?? ''} (mínimo: ${item.minQuantity})`,
            link: '/estoque',
            metadata: { itemId: item.id },
          },
        )
        .catch(() => undefined);
    }

    return result;
  }

  async createBulkPurchase(dto: BulkPurchaseDto, user?: AuditUser) {
    const freight = dto.freight ?? 0;
    const reason = dto.reason?.trim() || 'Compra em lote';

    const sumProducts = dto.lines.reduce((s, l) => s + Number(l.productTotal), 0);
    if (sumProducts <= 0) {
      throw new BadRequestException('A soma dos valores dos produtos deve ser maior que zero.');
    }

    const prepared: {
      itemId?: string;
      newItem?: BulkPurchaseDto['lines'][0]['newItem'];
      name: string;
      unit: string | null;
      quantity: number;
      productTotal: number;
      freightShare: number;
      totalPrice: number;
      unitCost: number;
      expiresAt: Date;
      previousQty: number;
      newQty: number;
      minQty: number;
    }[] = [];

    for (let i = 0; i < dto.lines.length; i++) {
      const line = dto.lines[i];
      const hasItem = !!line.itemId;
      const hasNew = !!line.newItem;
      if (hasItem === hasNew) {
        throw new BadRequestException(
          `Linha ${i + 1}: informe um item existente ou cadastre um item novo.`,
        );
      }

      let itemId: string | undefined;
      let newItem: (typeof line)['newItem'];
      let name: string;
      let unit: string | null;
      let previousQty: number;
      let minQty: number;

      if (hasItem) {
        const item = await this.prisma.inventoryItem.findUnique({ where: { id: line.itemId } });
        if (!item) throw new NotFoundException(`Linha ${i + 1}: item não encontrado.`);
        itemId = item.id;
        name = item.name;
        unit = item.unit;
        previousQty = Number(item.quantity);
        minQty = Number(item.minQuantity);
      } else {
        newItem = line.newItem;
        name = newItem!.name;
        unit = newItem!.unit ?? null;
        previousQty = 0;
        minQty = Number(newItem!.minQuantity ?? 0);
      }

      const productTotal = Number(line.productTotal);
      const freightShare =
        freight > 0
          ? Math.round(freight * (productTotal / sumProducts) * 100) / 100
          : 0;
      const totalPrice = Math.round((productTotal + freightShare) * 100) / 100;
      const quantity = Number(line.quantity);
      const unitCost = Math.round((totalPrice / quantity) * 100) / 100;
      const newQty = previousQty + quantity;
      const expiresAt = parseDateOnlyToUtcNoon(line.expiresAt)!;

      prepared.push({
        itemId,
        newItem,
        name,
        unit,
        quantity,
        productTotal,
        freightShare,
        totalPrice,
        unitCost,
        expiresAt,
        previousQty,
        newQty,
        minQty,
      });
    }

    // Ajuste de centavos no último item (arredondamento do frete)
    if (freight > 0 && prepared.length > 0) {
      const allocated = prepared.reduce((s, p) => s + p.freightShare, 0);
      const diff = Math.round((freight - allocated) * 100) / 100;
      if (diff !== 0) {
        const last = prepared[prepared.length - 1];
        last.freightShare = Math.round((last.freightShare + diff) * 100) / 100;
        last.totalPrice = Math.round((last.productTotal + last.freightShare) * 100) / 100;
        last.unitCost = Math.round((last.totalPrice / last.quantity) * 100) / 100;
      }
    }

    const grandTotal = Math.round((sumProducts + freight) * 100) / 100;

    await this.prisma.$transactionWithRetry(async (tx) => {
      for (const p of prepared) {
        let itemId = p.itemId;
        if (!itemId && p.newItem) {
          const created = await tx.inventoryItem.create({
            data: {
              name: p.newItem.name,
              sku: p.newItem.sku,
              description: p.newItem.description,
              minQuantity: p.newItem.minQuantity ?? 0,
              unit: p.newItem.unit,
            },
          });
          itemId = created.id;
          p.itemId = itemId;
        }

        await tx.inventoryMovement.create({
          data: {
            itemId: itemId!,
            type: MovementType.IN,
            quantity: p.quantity,
            reason,
            expiresAt: p.expiresAt,
          },
        });
        await tx.inventoryItem.update({
          where: { id: itemId! },
          data: {
            quantity: { increment: p.quantity },
            expiresAt: p.expiresAt,
            costPrice: new Prisma.Decimal(p.unitCost),
          },
        });
      }

      const detailLines = prepared
        .map(
          (p) =>
            `${p.name} (${p.quantity}${p.unit ? ` ${p.unit}` : ''} · R$${p.productTotal.toFixed(2)}` +
            (p.freightShare > 0 ? ` + frete R$${p.freightShare.toFixed(2)}` : '') +
            ` · unit. R$${p.unitCost.toFixed(2)})`,
        )
        .join('; ');

      await tx.financialEntry.create({
        data: {
          type: FinancialType.EXPENSE,
          description: `Compra em lote - ${prepared.length} item(ns)${freight > 0 ? ` · frete R$${freight.toFixed(2)}` : ''} — ${detailLines}`,
          amount: new Prisma.Decimal(grandTotal),
          category: 'Investimento em estoque',
          expenseType: ExpenseType.VARIABLE,
          paidAt: new Date(),
          invoiceIssued: false,
        },
      });
    });

    for (const p of prepared) {
      if (!(p.newQty <= p.minQty && p.previousQty > p.minQty)) continue;
      const recipients = await this.notifications.findUsersWithPermission('inventory:edit');
      this.notifications
        .notifyMany(
          recipients.map((u) => u.id),
          {
            type: NotificationType.INVENTORY_LOW_STOCK,
            title: 'Estoque baixo',
            message: `${p.name}: ${p.newQty} ${p.unit ?? ''} (mínimo: ${p.minQty})`,
            link: '/estoque',
            metadata: { itemId: p.itemId },
          },
        )
        .catch(() => undefined);
    }

    return {
      linesProcessed: prepared.length,
      productsTotal: Math.round(sumProducts * 100) / 100,
      freight: Math.round(freight * 100) / 100,
      grandTotal,
      items: prepared.map((p) => ({
        itemId: p.itemId!,
        name: p.name,
        quantity: p.quantity,
        productTotal: p.productTotal,
        freightShare: p.freightShare,
        totalPrice: p.totalPrice,
        unitCost: p.unitCost,
      })),
    };
  }
}
