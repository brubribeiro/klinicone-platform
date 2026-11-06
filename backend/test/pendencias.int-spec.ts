/**
 * Central de pendências com Nest + Postgres reais: regras, geração a partir de estoque, contas,
 * equipamentos, documentos, atendimentos e datas comemorativas, e o ciclo das pendências manuais.
 * As datas são relativas a "hoje no Brasil" (mesma conta do serviço), então não dependem do fuso.
 */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';

import { AppModule } from '../src/app.module';
import { PendenciasService } from '../src/pendencias/pendencias.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestClinic, purgeTenants, testSuffix, TestClinic } from './helpers/test-clinic';

jest.setTimeout(60_000);

const suffix = testSuffix();
const base = new PrismaClient();
const MISSING = '00000000-0000-0000-0000-000000000000';

let moduleRef: TestingModule;
let prisma: PrismaService;
let service: PendenciasService;
let C: TestClinic;

const as = <T>(fn: () => Promise<T>) => C.as(fn);
const brazilToday = () => new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
const shift = (n: number) => new Date(Date.parse(`${brazilToday()}T00:00:00Z`) + n * 86_400_000);
const day = (n: number) => shift(n).toISOString().slice(0, 10);

const actor = () => ({
  ...C.actor,
  permissions: [
    'inventory:view',
    'finance:view',
    'appointments:view',
    'equipment:view',
    'documents:view',
    'promotions:view',
  ],
});

beforeAll(async () => {
  moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  prisma = moduleRef.get(PrismaService);
  service = moduleRef.get(PendenciasService);
  C = await createTestClinic(base, 'Pendencias', suffix);
});

afterAll(async () => {
  await new Promise((r) => setTimeout(r, 500));
  if (C) await purgeTenants(base, [C.tenant.id]);
  await moduleRef?.close();
  await base.$disconnect();
});

describe('regras', () => {
  it('devolve os padrões, salva alterações e valida o responsável', async () => {
    const defaults = await as(() => service.getRules());
    expect(defaults).toHaveLength(7);
    expect(defaults.find((r) => r.rule === 'COMMEMORATIVE_DATE')).toMatchObject({ enabled: false, param: 60 });
    expect(defaults.find((r) => r.rule === 'DOCUMENT_UNSIGNED')?.param).toBeNull();

    const saved = await as(() =>
      service.updateRules(
        {
          rules: [
            { rule: 'LOW_STOCK', enabled: true, param: 2, assigneeId: C.admin.id },
            { rule: 'DOCUMENT_UNSIGNED', enabled: false, param: 5 },
          ],
        } as never,
        actor(),
      ),
    );
    expect(saved.find((r) => r.rule === 'LOW_STOCK')).toMatchObject({ param: 2, assigneeId: C.admin.id });
    expect(saved.find((r) => r.rule === 'DOCUMENT_UNSIGNED')).toMatchObject({ enabled: false, param: null });
    expect((await as(() => service.getRules())).find((r) => r.rule === 'LOW_STOCK')?.param).toBe(2);

    await expect(
      as(() => service.updateRules({ rules: [{ rule: 'LOW_STOCK', enabled: true, assigneeId: MISSING }] } as never, actor())),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('ignora configuração corrompida', async () => {
    await as(() => prisma.appSetting.update({ where: { tenantId_key: { tenantId: C.tenant.id, key: 'pending_rules' } }, data: { value: '{nao-json' } }));
    const rules = await as(() => service.getRules());
    expect(rules.find((r) => r.rule === 'LOW_STOCK')).toMatchObject({ enabled: true, param: 0 });
  });
});

describe('geração e ciclo de vida', () => {
  it('gera pendências de todas as regras, resolve, atribui e reabre', async () => {
    await as(() =>
      service.updateRules(
        {
          rules: [
            { rule: 'LOW_STOCK', enabled: true, param: 0 },
            { rule: 'EXPIRING_STOCK', enabled: true, param: 30 },
            { rule: 'BILLS_DUE', enabled: true, param: 10 },
            { rule: 'APPOINTMENT_NO_OUTCOME', enabled: true },
            { rule: 'EQUIPMENT_MAINTENANCE', enabled: true, param: 30 },
            { rule: 'DOCUMENT_UNSIGNED', enabled: true },
            { rule: 'COMMEMORATIVE_DATE', enabled: true, param: 365 },
          ],
        } as never,
        actor(),
      ),
    );

    // estoque baixo (um zerado, outro abaixo do mínimo) e com validade vencendo
    await as(() => prisma.inventoryItem.create({ data: { name: `Zerado ${suffix}`, quantity: 0, minQuantity: 5 } }));
    const low = await as(() => prisma.inventoryItem.create({ data: { name: `Baixo ${suffix}`, quantity: 3, minQuantity: 5, unit: 'ml' } }));
    await as(() => prisma.inventoryMovement.create({ data: { itemId: low.id, type: 'IN', quantity: 3, expiresAt: shift(200) } }));
    await as(() =>
      prisma.inventoryItem.create({ data: { name: `Vencido ${suffix}`, quantity: 4, expiresAt: shift(-3) } }),
    );
    await as(() => prisma.inventoryItem.create({ data: { name: `Vence logo ${suffix}`, quantity: 4, expiresAt: shift(1) } }));
    await as(() => prisma.inventoryItem.create({ data: { name: `Vence hoje ${suffix}`, quantity: 4, expiresAt: shift(0) } }));
    await as(() => prisma.inventoryItem.create({ data: { name: `Vence depois ${suffix}`, quantity: 4, expiresAt: shift(60) } }));

    // contas: avulsa vencendo + recorrente sem lançamento
    await as(() =>
      prisma.financialEntry.create({
        data: { type: 'EXPENSE', description: `Aluguel ${suffix}`, amount: 1500, dueDate: shift(2) },
      }),
    );
    await as(() =>
      prisma.recurringExpense.create({ data: { name: `Internet ${suffix}`, amount: 120, dueDay: new Date(shift(1)).getUTCDate() } }),
    );
    // equipamentos
    await as(() =>
      prisma.equipment.create({ data: { name: `Laser ${suffix}`, brand: 'Marca', model: 'X1', scheduledMaintenanceAt: shift(5) } }),
    );
    await as(() => prisma.equipment.create({ data: { name: `Ultrassom ${suffix}`, nextMaintenanceAt: shift(-2) } }));
    // documentos
    const patient = await as(() => prisma.patient.create({ data: { name: `Paciente ${suffix}` } }));
    await as(() => prisma.document.create({ data: { name: `Termo ${suffix}`, status: 'PENDING', patientId: patient.id } }));
    await as(() => prisma.document.create({ data: { name: `Contrato ${suffix}`, status: 'SENT' } }));
    // atendimento passado sem desfecho
    await as(() =>
      prisma.appointment.create({
        data: {
          patientId: patient.id,
          professionalId: C.admin.id,
          startAt: shift(-4),
          endAt: new Date(shift(-4).getTime() + 3600_000),
          status: 'SCHEDULED',
        },
      }),
    );

    const first = await as(() => service.list(actor()));
    const titles = first.items.map((i) => i.title);
    expect(titles).toEqual(
      expect.arrayContaining([
        `Repor Zerado ${suffix}`,
        `Repor Baixo ${suffix}`,
        `Validade próxima · Vencido ${suffix}`,
        `Pagar Aluguel ${suffix}`,
        `Pagar Internet ${suffix}`,
        `Manutenção · Laser ${suffix}`,
        `Manutenção · Ultrassom ${suffix}`,
        `Assinatura pendente · Termo ${suffix}`,
        `Assinatura pendente · Contrato ${suffix}`,
      ]),
    );
    expect(titles.some((t) => t.startsWith('Fechar atendimento de Paciente'))).toBe(true);
    expect(titles.some((t) => t.startsWith('Criar promoção'))).toBe(true);
    expect(titles).not.toContain(`Validade próxima · Vence depois ${suffix}`);
    expect(first.totalRules).toBe(7);
    expect(first.activeRules).toBe(7);
    // ordenação: atrasadas primeiro
    const groups = first.items.map((i) => i.group);
    expect(groups.indexOf('OVERDUE')).toBeLessThan(groups.lastIndexOf('UPCOMING'));
    expect(first.items.find((i) => i.title === `Repor Zerado ${suffix}`)?.group).toBe('OVERDUE');

    // sem permissão, regras da origem ficam de fora
    const limited = await as(() => service.list({ ...actor(), permissions: ['documents:view'] }));
    expect(limited.items.every((i) => i.rule === 'DOCUMENT_UNSIGNED' || i.rule === null)).toBe(true);

    // atribui e resolve pendência gerada
    const gen = first.items.find((i) => i.title === `Repor Zerado ${suffix}`)!;
    const assigned = await as(() => service.assign({ key: gen.key, assigneeId: C.admin.id }, actor()));
    expect(assigned.assigneeId).toBe(C.admin.id);
    // de novo: atualiza a existente
    await as(() => service.assign({ key: gen.key, assigneeId: null }, actor()));
    const resolved = await as(() => service.resolve(gen.key, actor()));
    expect(resolved.resolvedAt).not.toBeNull();
    const after = await as(() => service.list(actor()));
    expect(after.items.find((i) => i.key === gen.key)).toBeUndefined();
    expect(after.resolvedCount).toBeGreaterThanOrEqual(1);
    const history = await as(() => service.listResolved());
    expect(history.map((h) => h.sourceKey)).toContain(gen.key);

    const reopened = await as(() => service.reopen(resolved.id, actor()));
    expect(reopened.resolvedAt).toBeNull();
    expect((await as(() => service.list(actor()))).items.find((i) => i.key === gen.key)).toBeDefined();

    // resolve outra gerada ainda sem registro
    const other = first.items.find((i) => i.title === `Pagar Aluguel ${suffix}`)!;
    const created = await as(() => service.resolve(other.key, actor()));
    expect(created.sourceKey).toBe(other.key);

    await expect(as(() => service.resolve('APPOINTMENT:nada', actor()))).rejects.toBeInstanceOf(NotFoundException);
    await expect(as(() => service.reopen(MISSING, actor()))).rejects.toBeInstanceOf(NotFoundException);
  });

  it('promoção vigente com a mesma data comemorativa esconde a pendência', async () => {
    const before = await as(() => service.list(actor()));
    const item = before.items.find((i) => i.rule === 'COMMEMORATIVE_DATE')!;
    const name = item.title.replace('Criar promoção · ', '');
    await as(() =>
      prisma.promotion.create({
        data: { name: `Promo ${suffix}`, commemorativeDate: name.toUpperCase(), startAt: shift(0), endAt: shift(400), discountType: 'PERCENTAGE', discountValue: 10 },
      }),
    );
    const afterList = await as(() => service.list(actor()));
    expect(afterList.items.find((i) => i.key === item.key)).toBeUndefined();
  });
});

describe('pendências manuais', () => {
  it('cria, edita, resolve, atribui e remove', async () => {
    const t = await as(() =>
      service.create({ title: '  Ligar fornecedor ', category: 'ADMINISTRATIVE', dueDate: day(1), urgent: true, description: ' x ' } as never, actor()),
    );
    expect(t).toMatchObject({ title: 'Ligar fornecedor', urgent: true, description: 'x' });
    const noDue = await as(() => service.create({ title: 'Sem prazo', category: 'OPERATIONAL' } as never, actor()));
    const late = await as(() => service.create({ title: 'Atrasada', category: 'OPERATIONAL', dueDate: day(-3) } as never, actor()));

    const listed = await as(() => service.list(actor()));
    expect(listed.items.find((i) => i.key === `MANUAL:${t.id}`)).toMatchObject({ group: 'URGENT', urgent: true });
    expect(listed.items.find((i) => i.key === `MANUAL:${noDue.id}`)?.deadlineLabel).toBe('Sem prazo definido');
    expect(listed.items.find((i) => i.key === `MANUAL:${late.id}`)?.group).toBe('OVERDUE');

    const upd = await as(() =>
      service.update(t.id, { title: 'Novo', description: '', category: 'FINANCE', dueDate: null, urgent: false, assigneeId: C.admin.id }, actor()),
    );
    expect(upd).toMatchObject({ title: 'Novo', description: null, dueDate: null, assigneeId: C.admin.id });

    const asg = await as(() => service.assign({ key: `MANUAL:${t.id}`, assigneeId: null }, actor()));
    expect(asg.assigneeId).toBeNull();

    const res = await as(() => service.resolve(`MANUAL:${t.id}`, actor()));
    expect(res.resolvedAt).not.toBeNull();
    expect((await as(() => service.resolve(`MANUAL:${t.id}`, actor()))).id).toBe(t.id);

    expect(await as(() => service.remove(late.id, actor()))).toEqual({ ok: true });
    await expect(as(() => service.remove(late.id, actor()))).rejects.toBeInstanceOf(NotFoundException);
    await expect(as(() => service.update(MISSING, {}, actor()))).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      as(() => service.create({ title: 'x', category: 'FINANCE', assigneeId: MISSING } as never, actor())),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
