import { describe, expect, it } from 'vitest';

import type { Appointment, InventoryItem, Procedure } from '../../types';
import { availableStock, sumProcedureMaterials } from './MaterialsSection';

const protetor = { id: 'i1', quantity: 1 } as unknown as InventoryItem;
const alcool = { id: 'i2', quantity: 100 } as unknown as InventoryItem;
const limpeza = {
  id: 'p1',
  name: 'Limpeza',
  materials: [{ itemId: 'i2', quantity: 10 }],
} as unknown as Procedure;
const peeling = {
  id: 'p2',
  name: 'Peeling',
  materials: [
    { itemId: 'i1', quantity: 1 },
    { itemId: 'i2', quantity: 10 },
  ],
} as unknown as Procedure;

describe('sumProcedureMaterials', () => {
  it('adds up an item shared by two procedures', () => {
    const byItem = new Map(sumProcedureMaterials([limpeza, peeling]).map((m) => [m.itemId, m.quantity]));
    expect(byItem.get('i1')).toBe(1);
    expect(byItem.get('i2')).toBe(20);
  });
});

describe('availableStock', () => {
  it('gives back only what the saved procedures already deducted', () => {
    const saved = {
      procedureId: 'p1',
      materialsDeducted: true,
      appointmentProcedures: [{ procedureId: 'p1', sortOrder: 0 }],
    } as Appointment;
    const stock = availableStock([protetor, alcool], saved, [limpeza, peeling]);
    // Peeling acabou de ser adicionado: o protetor não foi baixado por este agendamento.
    expect(stock.get('i1')).toBe(1);
    expect(stock.get('i2')).toBe(110);
  });

  it('uses the raw stock when nothing was deducted', () => {
    const stock = availableStock([protetor, alcool], null, [limpeza, peeling]);
    expect(stock.get('i1')).toBe(1);
    expect(stock.get('i2')).toBe(100);
  });
});
