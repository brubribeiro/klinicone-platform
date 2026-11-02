import { BadRequestException, Injectable } from '@nestjs/common';
import { MovementType, Prisma } from '@prisma/client';

import { MaterialQuantity } from './appointment.helpers';

type Tx = Prisma.TransactionClient;

/** Baixa e devolução de estoque dos materiais (do procedimento e extras) de um agendamento. */
@Injectable()
export class AppointmentMaterialsService {
  normalizeExtraMaterials(extras?: { itemId: string; quantity: number }[]): MaterialQuantity[] {
    if (!extras?.length) return [];
    const map = new Map<string, number>();
    for (const extra of extras) {
      map.set(extra.itemId, (map.get(extra.itemId) ?? 0) + extra.quantity);
    }
    return [...map.entries()].map(([itemId, quantity]) => ({
      itemId,
      quantity: new Prisma.Decimal(quantity),
    }));
  }

  async deductItems(tx: Tx, items: MaterialQuantity[], reason: string) {
    if (items.length === 0) return;

    const insufficient: string[] = [];
    for (const item of items) {
      const inv = await tx.inventoryItem.findUnique({ where: { id: item.itemId } });
      if (!inv) {
        throw new BadRequestException('Item de estoque não encontrado.');
      }
      if (Number(inv.quantity) < Number(item.quantity)) {
        insufficient.push(
          `${inv.name} (necessário ${item.quantity}, disponível ${inv.quantity})`,
        );
      }
    }
    if (insufficient.length > 0) {
      throw new BadRequestException(`Estoque insuficiente: ${insufficient.join('; ')}`);
    }

    for (const item of items) {
      await tx.inventoryItem.update({
        where: { id: item.itemId },
        data: { quantity: { decrement: item.quantity } },
      });
      await tx.inventoryMovement.create({
        data: { itemId: item.itemId, type: MovementType.OUT, quantity: item.quantity, reason },
      });
    }
  }

  private async returnItems(tx: Tx, items: MaterialQuantity[], reason: string) {
    for (const item of items) {
      await tx.inventoryItem.update({
        where: { id: item.itemId },
        data: { quantity: { increment: item.quantity } },
      });
      await tx.inventoryMovement.create({
        data: { itemId: item.itemId, type: MovementType.IN, quantity: item.quantity, reason },
      });
    }
  }

  async deductProcedureMaterials(tx: Tx, procedureId: string, reason: string) {
    const materials = await tx.procedureMaterial.findMany({ where: { procedureId } });
    await this.deductItems(tx, materials, reason);
  }

  private async returnProcedureMaterials(tx: Tx, procedureId: string, reason: string) {
    const materials = await tx.procedureMaterial.findMany({ where: { procedureId } });
    await this.returnItems(tx, materials, reason);
  }

  /** Devolve materiais do procedimento e extras já baixados de um agendamento. */
  async returnAllForAppointment(
    tx: Tx,
    appt: { id: string; procedureIds: string[] },
    procedureReason: string,
    extrasReason: string,
  ) {
    for (const procedureId of appt.procedureIds) {
      await this.returnProcedureMaterials(tx, procedureId, procedureReason);
    }
    const extras = await tx.appointmentMaterial.findMany({ where: { appointmentId: appt.id } });
    await this.returnItems(tx, extras, extrasReason);
  }

  async replaceExtraMaterialRecords(tx: Tx, appointmentId: string, items: MaterialQuantity[]) {
    await tx.appointmentMaterial.deleteMany({ where: { appointmentId } });
    if (items.length === 0) return;
    await tx.appointmentMaterial.createMany({
      data: items.map((item) => ({
        appointmentId,
        itemId: item.itemId,
        quantity: item.quantity,
      })),
    });
  }

  /**
   * Ajusta o estoque na edição: devolve ao desativar, troca ao mudar de procedimento,
   * baixa ao reativar, e aplica a diferença dos extras quando eles mudam.
   */
  async syncOnUpdate(
    tx: Tx,
    before: {
      id: string;
      procedureIds: string[];
      materialsDeducted: boolean;
      extraMaterials: MaterialQuantity[];
    },
    next: {
      procedureIds: string[];
      willBeActive: boolean;
      willDeduct: boolean;
      extraItems?: MaterialQuantity[];
    },
  ) {
    const { procedureIds: newProcedureIds, willBeActive, willDeduct, extraItems } = next;
    const beforeSet = new Set(before.procedureIds);
    const afterSet = new Set(newProcedureIds);
    const procedureChanged =
      beforeSet.size !== afterSet.size || [...beforeSet].some((id) => !afterSet.has(id));

    if (before.materialsDeducted && !willBeActive) {
      await this.returnAllForAppointment(
        tx,
        before,
        'Devolução por cancelamento/no-show',
        'Devolução de materiais extras por cancelamento/no-show',
      );
    } else if (before.materialsDeducted && willBeActive && procedureChanged) {
      for (const removedId of before.procedureIds) {
        if (!afterSet.has(removedId)) {
          await this.returnProcedureMaterials(tx, removedId, 'Devolução por troca de procedimento');
        }
      }
      for (const addedId of newProcedureIds) {
        if (!beforeSet.has(addedId)) {
          await this.deductProcedureMaterials(tx, addedId, 'Materiais do agendamento (novo procedimento)');
        }
      }
    } else if (!before.materialsDeducted && willDeduct && newProcedureIds.length > 0) {
      for (const procedureId of newProcedureIds) {
        await this.deductProcedureMaterials(tx, procedureId, 'Materiais do agendamento (reativado)');
      }
    }

    if (extraItems !== undefined) {
      if (before.materialsDeducted && willBeActive) {
        await this.applyExtraMaterialsStockDiff(tx, before.extraMaterials, extraItems);
      }
      await this.replaceExtraMaterialRecords(tx, before.id, extraItems);
      if (!before.materialsDeducted && willBeActive && extraItems.length > 0) {
        await this.deductItems(tx, extraItems, 'Materiais extras do agendamento (reativado)');
      }
    } else if (!before.materialsDeducted && willBeActive && before.extraMaterials.length > 0) {
      await this.deductItems(tx, before.extraMaterials, 'Materiais extras do agendamento (reativado)');
    }
  }

  private async applyExtraMaterialsStockDiff(
    tx: Tx,
    before: MaterialQuantity[],
    after: MaterialQuantity[],
  ) {
    const oldMap = new Map(before.map((item) => [item.itemId, Number(item.quantity)]));
    const newMap = new Map(after.map((item) => [item.itemId, Number(item.quantity)]));
    const toReturn: MaterialQuantity[] = [];
    const toDeduct: MaterialQuantity[] = [];
    const entry = (itemId: string, quantity: number) => ({
      itemId,
      quantity: new Prisma.Decimal(quantity),
    });

    for (const [itemId, oldQty] of oldMap) {
      const newQty = newMap.get(itemId) ?? 0;
      if (newQty < oldQty) {
        toReturn.push(entry(itemId, oldQty - newQty));
      } else if (newQty > oldQty) {
        toDeduct.push(entry(itemId, newQty - oldQty));
      }
    }
    for (const [itemId, newQty] of newMap) {
      if (!oldMap.has(itemId)) {
        toDeduct.push(entry(itemId, newQty));
      }
    }

    if (toReturn.length > 0) {
      await this.returnItems(tx, toReturn, 'Devolução de material extra do agendamento');
    }
    if (toDeduct.length > 0) {
      await this.deductItems(tx, toDeduct, 'Material extra do agendamento');
    }
  }
}
