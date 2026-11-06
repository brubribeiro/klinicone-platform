/** Equipamentos e estoque (movimentações, compra em lote, exclusão) com Nest + Postgres reais. */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';

import { AppModule } from '../src/app.module';
import { EquipmentService } from '../src/equipment/equipment.service';
import { InventoryService } from '../src/inventory/inventory.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestClinic, purgeTenants, testSuffix, TestClinic } from './helpers/test-clinic';

jest.setTimeout(60_000);

const suffix = testSuffix();
const base = new PrismaClient();
const MISSING = '00000000-0000-0000-0000-000000000000';

let moduleRef: TestingModule;
let prisma: PrismaService;
let equipment: EquipmentService;
let inventory: InventoryService;
let C: TestClinic;
const as = <T>(fn: () => Promise<T>) => C.as(fn);

beforeAll(async () => {
  moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  prisma = moduleRef.get(PrismaService);
  equipment = moduleRef.get(EquipmentService);
  inventory = moduleRef.get(InventoryService);
  C = await createTestClinic(base, 'EquipEstoque', suffix);
});

afterAll(async () => {
  await new Promise((r) => setTimeout(r, 500));
  if (C) await purgeTenants(base, [C.tenant.id]);
  await moduleRef?.close();
  await base.$disconnect();
});

describe('equipamentos', () => {
  it('cria com manutenção agendada (gera despesa uma vez por mês), edita, registra manutenção e remove', async () => {
    const eq = await as(() =>
      equipment.create(
        {
          name: `Laser ${suffix}`,
          lastMaintenanceAt: '2031-01-10',
          maintenanceIntervalMonths: 6,
          maintenanceValue: 300,
          maintenanceNotifyDaysBefore: 15,
          scheduledMaintenanceAt: '2031-05-20',
          purchaseDate: '2030-01-01',
        },
        C.actor,
      ),
    );
    expect(eq.nextMaintenanceAt?.toISOString().slice(0, 7)).toBe('2031-07');
    const expenses = () => base.financialEntry.findMany({ where: { equipmentId: eq.id } });
    expect(await expenses()).toHaveLength(1);

    // mesma competência: não duplica
    await as(() => equipment.update(eq.id, { scheduledMaintenanceAt: '2031-05-25' }, C.actor));
    expect(await expenses()).toHaveLength(1);
    // outro mês: nova despesa, com novo valor
    await as(() => equipment.update(eq.id, { scheduledMaintenanceAt: '2031-08-05', maintenanceValue: 400 }));
    expect(await expenses()).toHaveLength(2);
    // sem alteração da data agendada
    await as(() => equipment.update(eq.id, { scheduledMaintenanceAt: '2031-08-05', notes: 'ok', purchaseDate: '2030-02-02', lastMaintenanceAt: '2031-02-01' }));
    expect(await expenses()).toHaveLength(2);

    expect((await as(() => equipment.list())).map((e) => e.id)).toContain(eq.id);
    expect((await as(() => equipment.dueSoon(5000))).map((e) => e.id)).toContain(eq.id);
    expect((await as(() => equipment.dueSoon())).map((e) => e.id)).not.toContain(eq.id);

    const done = await as(() => equipment.registerMaintenance(eq.id));
    expect(done.scheduledMaintenanceAt).toBeNull();
    expect(done.nextMaintenanceAt).not.toBeNull();

    expect(await as(() => equipment.remove(eq.id, C.actor))).toEqual({ ok: true });
    await expect(as(() => equipment.findOne(eq.id))).rejects.toBeInstanceOf(NotFoundException);
    await expect(as(() => equipment.update(MISSING, {}))).rejects.toBeInstanceOf(NotFoundException);
  });

  it('cria simples sem agendamento nem despesa', async () => {
    const eq = await as(() => equipment.create({ name: `Simples ${suffix}`, scheduledMaintenanceAt: '2031-05-20' }));
    expect(await base.financialEntry.count({ where: { equipmentId: eq.id } })).toBe(0);
    // agenda depois sem valor de manutenção: sem despesa
    await as(() => equipment.update(eq.id, { scheduledMaintenanceAt: '2031-06-20' }));
    expect(await base.financialEntry.count({ where: { equipmentId: eq.id } })).toBe(0);
  });
});

describe('estoque', () => {
  it('movimenta entradas, saídas e ajustes mantendo saldo, custo e despesa', async () => {
    const item = await as(() => inventory.create({ name: `Soro ${suffix}`, quantity: 10, minQuantity: 5, unit: 'ml' } as never, C.actor));
    await expect(as(() => inventory.createMovement(item.id, { type: 'IN', quantity: 5 } as never))).rejects.toBeInstanceOf(BadRequestException);

    const [mvIn, afterIn] = await as(() =>
      inventory.createMovement(item.id, { type: 'IN', quantity: 10, totalPrice: 100, expiresAt: '2032-01-01', reason: 'Compra' } as never, C.actor),
    );
    expect(mvIn.type).toBe('IN');
    expect(Number(afterIn.quantity)).toBe(20);
    expect(Number(afterIn.costPrice)).toBe(10);
    expect(afterIn.expiresAt?.toISOString().slice(0, 10)).toBe('2032-01-01');
    expect(await base.financialEntry.count({ where: { category: 'Investimento em estoque', description: { contains: `Soro ${suffix}` } } })).toBe(1);

    const [, afterOut] = await as(() => inventory.createMovement(item.id, { type: 'OUT', quantity: 8 } as never, C.actor));
    expect(Number(afterOut.quantity)).toBe(12);
    // cruza o mínimo: dispara notificação
    const [, afterAdj] = await as(() => inventory.createMovement(item.id, { type: 'ADJUSTMENT', quantity: 4 } as never, C.actor));
    expect(Number(afterAdj.quantity)).toBe(4);
    await expect(as(() => inventory.createMovement(item.id, { type: 'OUT', quantity: 99 } as never))).rejects.toThrow('insuficiente');

    expect((await as(() => inventory.listLowStock())).map((i) => i.id)).toContain(item.id);
    expect((await as(() => inventory.list())).map((i) => i.id)).toContain(item.id);
    const found = await as(() => inventory.findOne(item.id));
    expect(found.movements).toHaveLength(3);

    const upd = await as(() => inventory.update(item.id, { name: `Soro 2 ${suffix}` } as never, C.actor));
    expect(upd.name).toBe(`Soro 2 ${suffix}`);
    await expect(as(() => inventory.findOne(MISSING))).rejects.toBeInstanceOf(NotFoundException);
  });

  it('bloqueia exclusão de item em uso e remove os livres', async () => {
    const used = await as(() => inventory.create({ name: `Usado ${suffix}`, quantity: 5 } as never));
    const proc = await as(() => prisma.procedure.create({ data: { name: `Proc ${suffix}`, price: 10 } }));
    await as(() => prisma.procedureMaterial.create({ data: { procedureId: proc.id, itemId: used.id, quantity: 1 } }));

    const preview = await as(() => inventory.getDeletionPreview(used.id));
    expect(preview).toMatchObject({ canDelete: false, appointmentCount: 0 });
    expect(preview.procedures.map((p) => p.id)).toEqual([proc.id]);
    await expect(as(() => inventory.remove(used.id))).rejects.toThrow('procedimentos');

    // usado também em atendimento
    const patient = await as(() => prisma.patient.create({ data: { name: `Pac ${suffix}` } }));
    const appt = await as(() =>
      prisma.appointment.create({
        data: { patientId: patient.id, professionalId: C.admin.id, startAt: new Date('2031-02-01T13:00:00Z'), endAt: new Date('2031-02-01T14:00:00Z') },
      }),
    );
    await as(() => prisma.appointmentMaterial.create({ data: { appointmentId: appt.id, itemId: used.id, quantity: 1 } }));
    await expect(as(() => inventory.remove(used.id))).rejects.toThrow('agendamento(s) e nos procedimentos');

    const onlyAppt = await as(() => inventory.create({ name: `SoAtend ${suffix}`, quantity: 5 } as never));
    await as(() => prisma.appointmentMaterial.create({ data: { appointmentId: appt.id, itemId: onlyAppt.id, quantity: 1 } }));
    await expect(as(() => inventory.remove(onlyAppt.id))).rejects.toThrow(/agendamento\(s\)\.$/);

    const free = await as(() => inventory.create({ name: `Livre ${suffix}`, quantity: 5 } as never));
    await as(() => inventory.createMovement(free.id, { type: 'OUT', quantity: 1 } as never));
    expect(await as(() => inventory.remove(free.id, C.actor))).toEqual({ ok: true });
    await expect(as(() => inventory.findOne(free.id))).rejects.toBeInstanceOf(NotFoundException);
  });

  it('compra em lote rateia o frete e cria itens novos', async () => {
    const existing = await as(() => inventory.create({ name: `Lote A ${suffix}`, quantity: 20, minQuantity: 10 } as never));
    const res = await as(() =>
      inventory.createBulkPurchase(
        {
          freight: 10,
          reason: ' ',
          lines: [
            { itemId: existing.id, quantity: 5, productTotal: 50, expiresAt: '2032-03-01' },
            { newItem: { name: `Lote B ${suffix}`, unit: 'un', minQuantity: 1 }, quantity: 3, productTotal: 25, expiresAt: '2032-04-01' },
            { newItem: { name: `Lote C ${suffix}` }, quantity: 7, productTotal: 25, expiresAt: '2032-05-01' },
          ],
        } as never,
        C.actor,
      ),
    );
    expect(res).toMatchObject({ linesProcessed: 3, productsTotal: 100, freight: 10, grandTotal: 110 });
    expect(res.items.reduce((s, i) => s + i.freightShare, 0)).toBeCloseTo(10, 2);
    const stock = await base.inventoryItem.findUniqueOrThrow({ where: { id: existing.id } });
    expect(Number(stock.quantity)).toBe(25);
    expect(await base.inventoryItem.count({ where: { tenantId: C.tenant.id, name: { startsWith: 'Lote B' } } })).toBe(1);
    const mv = await base.inventoryMovement.findFirstOrThrow({ where: { itemId: existing.id } });
    expect(mv.reason).toBe('Compra em lote');
  });

  it('valida compra em lote', async () => {
    const lines = (l: unknown[]) => ({ lines: l }) as never;
    await expect(as(() => inventory.createBulkPurchase(lines([{ itemId: MISSING, quantity: 1, productTotal: 0 }])))).rejects.toThrow('maior que zero');
    await expect(as(() => inventory.createBulkPurchase(lines([{ quantity: 1, productTotal: 10 }])))).rejects.toThrow('Linha 1');
    await expect(as(() => inventory.createBulkPurchase(lines([{ itemId: MISSING, quantity: 1, productTotal: 10 }])))).rejects.toBeInstanceOf(NotFoundException);
  });
});
