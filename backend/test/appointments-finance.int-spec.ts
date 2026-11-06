/**
 * Fluxos críticos de agendamento, financeiro, pacotes e promoções com Nest + Postgres reais.
 * Cada bloco usa procedimentos, estoque e datas próprios para não depender da ordem dos testes.
 * Exige DATABASE_URL com as migrations aplicadas (no CI: Postgres de serviço do job backend).
 */
import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppointmentKind, AppointmentStatus, PrismaClient } from '@prisma/client';

import { AppModule } from '../src/app.module';
import { AppointmentsService } from '../src/appointments/appointments.service';
import { PackagesService } from '../src/packages/packages.service';
import { PromotionsService } from '../src/promotions/promotions.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestClinic, purgeTenants, testSuffix, TestClinic } from './helpers/test-clinic';

jest.setTimeout(60_000);

const suffix = testSuffix();
const base = new PrismaClient();

let moduleRef: TestingModule;
let prisma: PrismaService;
let appointments: AppointmentsService;
let packages: PackagesService;
let promotions: PromotionsService;
let C: TestClinic;

/** Horário livre e único por chamada (dias distintos, 10h em Brasília) para não haver conflito de agenda. */
let dayCursor = 0;
function nextSlot(minutes = 60, baseDate = '2030-04-01') {
  const start = new Date(`${baseDate}T13:00:00.000Z`);
  start.setUTCDate(start.getUTCDate() + dayCursor++);
  const end = new Date(start.getTime() + minutes * 60_000);
  return { startAt: start.toISOString(), endAt: end.toISOString() };
}

function slotOn(date: string, minutes = 60) {
  const start = new Date(`${date}T13:00:00.000Z`);
  return { startAt: start.toISOString(), endAt: new Date(start.getTime() + minutes * 60_000).toISOString() };
}

const as = <T>(fn: () => Promise<T>) => C.as(fn);

async function makePatient(name: string) {
  return as(() => prisma.patient.create({ data: { name: `${name} ${suffix}` } }));
}

async function makeProcedure(name: string, price: number, extra: { durationMinutes?: number; recurrenceDays?: number } = {}) {
  return as(() => prisma.procedure.create({ data: { name: `${name} ${suffix}`, price, ...extra } }));
}

async function makeItem(name: string, quantity: number, costPrice?: number) {
  return as(() => prisma.inventoryItem.create({ data: { name: `${name} ${suffix}`, quantity, costPrice } }));
}

async function addMaterial(procedureId: string, itemId: string, quantity: number) {
  return as(() => prisma.procedureMaterial.create({ data: { procedureId, itemId, quantity } }));
}

async function stockOf(itemId: string) {
  const item = await base.inventoryItem.findUniqueOrThrow({ where: { id: itemId } });
  return Number(item.quantity);
}

async function entriesOf(appointmentId: string) {
  return base.financialEntry.findMany({ where: { appointmentId }, orderBy: { createdAt: 'asc' } });
}

function book(data: {
  patientId: string;
  procedureIds?: string[];
  procedureId?: string;
  kind?: AppointmentKind;
  status?: AppointmentStatus;
  patientPackageId?: string;
  extraMaterials?: { itemId: string; quantity: number }[];
  slot?: { startAt: string; endAt: string };
}) {
  const { slot, ...rest } = data;
  return as(() =>
    appointments.create({ ...rest, professionalId: C.admin.id, ...(slot ?? nextSlot()) }, C.actor),
  );
}

function complete(id: string, extra: Record<string, unknown> = {}) {
  return as(() => appointments.update(id, { status: AppointmentStatus.COMPLETED, ...extra }, C.actor));
}

beforeAll(async () => {
  moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  prisma = moduleRef.get(PrismaService);
  appointments = moduleRef.get(AppointmentsService);
  packages = moduleRef.get(PackagesService);
  promotions = moduleRef.get(PromotionsService);
  C = await createTestClinic(base, 'Fluxos', suffix);
});

afterAll(async () => {
  // eventos/auditoria disparados sem await ainda podem estar gravando
  await new Promise((r) => setTimeout(r, 500));
  if (C) await purgeTenants(base, [C.tenant.id]);
  await moduleRef?.close();
  await base.$disconnect();
});

describe('agendamento com vários procedimentos', () => {
  it('grava os procedimentos na ordem, sem duplicar, e o primeiro vira o procedureId legado', async () => {
    const patient = await makePatient('Multi');
    const p1 = await makeProcedure('Limpeza', 150, { durationMinutes: 60 });
    const p2 = await makeProcedure('Peeling', 200, { durationMinutes: 30 });

    // duração somada (60 + 30) é responsabilidade do painel; a API grava o intervalo recebido
    const slot = nextSlot(90);
    const appt = await book({ patientId: patient.id, procedureIds: [p2.id, p1.id, p2.id], slot });

    expect(appt.procedureId).toBe(p2.id);
    expect(appt.appointmentProcedures.map((r) => [r.procedureId, r.sortOrder])).toEqual([
      [p2.id, 0],
      [p1.id, 1],
    ]);
    expect(appt.endAt.getTime() - appt.startAt.getTime()).toBe(90 * 60_000);
  });

  it('exige procedimento para PROCEDURE e dispensa para avaliação e retorno', async () => {
    const patient = await makePatient('Sem procedimento');
    await expect(book({ patientId: patient.id, procedureIds: [] })).rejects.toBeInstanceOf(BadRequestException);

    const evaluation = await book({ patientId: patient.id, kind: AppointmentKind.EVALUATION });
    expect(evaluation.procedureId).toBeNull();
    expect(evaluation.appointmentProcedures).toHaveLength(0);

    const ret = await book({ patientId: patient.id, kind: AppointmentKind.RETURN });
    expect(ret.kind).toBe(AppointmentKind.RETURN);
  });

  it('recusa procedimento inexistente ou inativo', async () => {
    const patient = await makePatient('Inativo');
    const inactive = await as(() =>
      prisma.procedure.create({ data: { name: `Inativo ${suffix}`, price: 10, active: false } }),
    );
    await expect(book({ patientId: patient.id, procedureIds: [inactive.id] })).rejects.toThrow('Procedimento inativo');
    await expect(
      book({ patientId: patient.id, procedureIds: ['00000000-0000-0000-0000-000000000000'] }),
    ).rejects.toThrow('não foram encontrados');
  });

  it('recusa conflito de horário do mesmo profissional', async () => {
    const patient = await makePatient('Conflito');
    const p = await makeProcedure('Conflito', 100);
    const slot = nextSlot();
    await book({ patientId: patient.id, procedureIds: [p.id], slot });
    await expect(book({ patientId: patient.id, procedureIds: [p.id], slot })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('troca de procedimentos na edição regrava as linhas', async () => {
    const patient = await makePatient('Troca');
    const p1 = await makeProcedure('Troca A', 100);
    const p2 = await makeProcedure('Troca B', 100);
    const p3 = await makeProcedure('Troca C', 100);
    const appt = await book({ patientId: patient.id, procedureIds: [p1.id, p2.id] });

    const updated = await as(() => appointments.update(appt.id, { procedureIds: [p3.id, p1.id] }, C.actor));
    expect(updated.procedureId).toBe(p3.id);
    expect(updated.appointmentProcedures.map((r) => r.procedureId)).toEqual([p3.id, p1.id]);
  });
});

describe('estoque e materiais', () => {
  it('baixa materiais de todos os procedimentos e extras, devolve ao cancelar e baixa de novo ao reativar', async () => {
    const patient = await makePatient('Estoque');
    const item = await makeItem('Luva', 20, 1.5);
    const extra = await makeItem('Gaze', 10, 0.5);
    const p1 = await makeProcedure('Est A', 100);
    const p2 = await makeProcedure('Est B', 100);
    await addMaterial(p1.id, item.id, 2);
    await addMaterial(p2.id, item.id, 3);

    const appt = await book({
      patientId: patient.id,
      procedureIds: [p1.id, p2.id],
      extraMaterials: [
        { itemId: extra.id, quantity: 1 },
        { itemId: extra.id, quantity: 2 },
      ],
    });
    expect(appt.materialsDeducted).toBe(true);
    expect(await stockOf(item.id)).toBe(15);
    expect(await stockOf(extra.id)).toBe(7);

    // extras somados por item numa linha só
    const extras = await base.appointmentMaterial.findMany({ where: { appointmentId: appt.id } });
    expect(extras.map((e) => Number(e.quantity))).toEqual([3]);

    await as(() => appointments.update(appt.id, { status: AppointmentStatus.CANCELLED }, C.actor));
    expect(await stockOf(item.id)).toBe(20);
    expect(await stockOf(extra.id)).toBe(10);

    const reactivated = await as(() =>
      appointments.update(appt.id, { status: AppointmentStatus.SCHEDULED }, C.actor),
    );
    expect(reactivated.materialsDeducted).toBe(true);
    expect(await stockOf(item.id)).toBe(15);
    expect(await stockOf(extra.id)).toBe(7);
  });

  it('na troca de procedimento devolve o removido e baixa só o novo; extras aplicam a diferença', async () => {
    const patient = await makePatient('Troca estoque');
    const item = await makeItem('Agulha', 10);
    const other = await makeItem('Seringa', 10);
    const extra = await makeItem('Algodão', 10);
    const keep = await makeProcedure('Fica', 100);
    const removed = await makeProcedure('Sai', 100);
    const added = await makeProcedure('Entra', 100);
    await addMaterial(keep.id, item.id, 1);
    await addMaterial(removed.id, item.id, 2);
    await addMaterial(added.id, other.id, 4);

    const appt = await book({
      patientId: patient.id,
      procedureIds: [keep.id, removed.id],
      extraMaterials: [{ itemId: extra.id, quantity: 3 }],
    });
    expect(await stockOf(item.id)).toBe(7);

    await as(() =>
      appointments.update(
        appt.id,
        { procedureIds: [keep.id, added.id], extraMaterials: [{ itemId: extra.id, quantity: 1 }] },
        C.actor,
      ),
    );
    expect(await stockOf(item.id)).toBe(9);
    expect(await stockOf(other.id)).toBe(6);
    expect(await stockOf(extra.id)).toBe(9);
  });

  it('estoque insuficiente recusa o agendamento sem gravar nada', async () => {
    const patient = await makePatient('Insuficiente');
    const item = await makeItem('Ácido', 1);
    const p = await makeProcedure('Caro', 100);
    await addMaterial(p.id, item.id, 5);

    await expect(book({ patientId: patient.id, procedureIds: [p.id] })).rejects.toThrow('Estoque insuficiente');
    expect(await stockOf(item.id)).toBe(1);
    expect(await base.appointment.count({ where: { patientId: patient.id } })).toBe(0);
  });

  it('agendamento cancelado na criação não baixa estoque; excluir devolve o que foi baixado', async () => {
    const patient = await makePatient('Excluir');
    const item = await makeItem('Máscara', 5);
    const p = await makeProcedure('Máscara', 100);
    await addMaterial(p.id, item.id, 2);

    const cancelled = await book({ patientId: patient.id, procedureIds: [p.id], status: AppointmentStatus.CANCELLED });
    expect(cancelled.materialsDeducted).toBe(false);
    expect(await stockOf(item.id)).toBe(5);

    const appt = await book({ patientId: patient.id, procedureIds: [p.id] });
    expect(await stockOf(item.id)).toBe(3);
    await as(() => appointments.remove(appt.id, C.actor));
    expect(await stockOf(item.id)).toBe(5);
  });
});

describe('agendamento antigo (só procedureId, sem appointment_procedures)', () => {
  async function legacyAppointment(procedureId: string, patientId: string, data: Record<string, unknown> = {}) {
    return as(() =>
      prisma.appointment.create({
        data: { patientId, procedureId, professionalId: C.admin.id, ...nextSlot(), ...data },
      }),
    );
  }

  it('aparece com o procedimento como único item na leitura e na lista', async () => {
    const patient = await makePatient('Legado');
    const p = await makeProcedure('Legado', 120);
    const legacy = await legacyAppointment(p.id, patient.id);

    const one = await as(() => appointments.findOne(legacy.id));
    expect(one.appointmentProcedures).toEqual([
      expect.objectContaining({ id: `legacy-${legacy.id}`, procedureId: p.id, sortOrder: 0 }),
    ]);

    const list = await as(() => appointments.list(legacy.startAt.toISOString(), legacy.endAt.toISOString()));
    const row = list.find((a) => a.id === legacy.id);
    expect(row?.appointmentProcedures.map((r) => r.procedureId)).toEqual([p.id]);
  });

  it('concluir gera a receita do procedureId legado', async () => {
    const patient = await makePatient('Legado conclui');
    const p = await makeProcedure('Legado conclui', 180);
    const legacy = await legacyAppointment(p.id, patient.id);

    const done = await complete(legacy.id);
    expect(done.financeGenerated).toBe(true);
    const [income] = await entriesOf(legacy.id);
    expect(income).toMatchObject({ type: 'INCOME', category: 'Atendimentos' });
    expect(Number(income.amount)).toBe(180);
    // sem procedureIds no update, não cria linhas novas
    expect(await base.appointmentProcedure.count({ where: { appointmentId: legacy.id } })).toBe(0);
  });

  it('excluir devolve os materiais do procedureId legado', async () => {
    const patient = await makePatient('Legado exclui');
    const item = await makeItem('Legado item', 10);
    const p = await makeProcedure('Legado exclui', 100);
    await addMaterial(p.id, item.id, 4);
    await base.inventoryItem.update({ where: { id: item.id }, data: { quantity: 6 } });
    const legacy = await legacyAppointment(p.id, patient.id, { materialsDeducted: true });

    await as(() => appointments.remove(legacy.id, C.actor));
    expect(await stockOf(item.id)).toBe(10);
  });

  it('backfill lança receita de concluídos antigos sem financeiro', async () => {
    const patient = await makePatient('Backfill');
    const p = await makeProcedure('Backfill', 90);
    const legacy = await legacyAppointment(p.id, patient.id, { status: AppointmentStatus.COMPLETED });

    const result = await as(() => appointments.backfillFinance());
    expect(result.created).toBeGreaterThanOrEqual(1);
    const [income] = await entriesOf(legacy.id);
    expect(Number(income.amount)).toBe(90);
    expect((await base.appointment.findUniqueOrThrow({ where: { id: legacy.id } })).financeGenerated).toBe(true);
  });
});

describe('intervalo de retorno', () => {
  it('bloqueia agendar o mesmo procedimento antes de recurrenceDays após o último concluído', async () => {
    const patient = await makePatient('Retorno');
    const p = await makeProcedure('Botox', 900, { recurrenceDays: 30 });
    const first = await book({ patientId: patient.id, procedureIds: [p.id], slot: slotOn('2031-01-10') });
    await complete(first.id);

    const limit = await as(() => appointments.getRecurrenceLimit(patient.id, p.id));
    expect(limit).toMatchObject({ recurrenceDays: 30, earliestDate: '2031-02-09' });

    await expect(
      book({ patientId: patient.id, procedureIds: [p.id], slot: slotOn('2031-01-25') }),
    ).rejects.toThrow('Intervalo de retorno');
    // vale também quando o procedimento está junto com outros
    const other = await makeProcedure('Outro', 50);
    await expect(
      book({ patientId: patient.id, procedureIds: [other.id, p.id], slot: slotOn('2031-01-26') }),
    ).rejects.toThrow('Intervalo de retorno');

    const ok = await book({ patientId: patient.id, procedureIds: [p.id], slot: slotOn('2031-02-09') });
    expect(ok.id).toBeDefined();
  });
});

describe('financeiro ao concluir', () => {
  it('uma receita por procedimento, taxa da forma de pagamento, parcelas e custo dos materiais', async () => {
    const patient = await makePatient('Pagamento');
    const item = await makeItem('Insumo', 50, 2.5);
    const extra = await makeItem('Extra', 50, 4);
    const p1 = await makeProcedure('Pag A', 300);
    const p2 = await makeProcedure('Pag B', 99.9);
    await addMaterial(p1.id, item.id, 2);
    const card = await as(() =>
      prisma.paymentMethod.create({ data: { name: `Crédito ${suffix}`, feePercent: 3.5 } }),
    );

    const appt = await book({
      patientId: patient.id,
      procedureIds: [p1.id, p2.id],
      extraMaterials: [{ itemId: extra.id, quantity: 1 }],
    });
    const done = await complete(appt.id, {
      paymentMethodId: card.id,
      installments: 3,
      cardBrand: ' Visa ',
      authorizationCode: '123456',
    });
    expect(done.financeGenerated).toBe(true);

    const entries = await entriesOf(appt.id);
    const incomes = entries.filter((e) => e.type === 'INCOME');
    expect(incomes.map((e) => [Number(e.amount), Number(e.netAmount)]).sort()).toEqual(
      [
        [300, 289.5],
        [99.9, 96.4],
      ].sort(),
    );
    for (const e of incomes) {
      expect(e).toMatchObject({
        category: 'Atendimentos',
        installments: 3,
        cardBrand: 'Visa',
        authorizationCode: '123456',
        paymentMethodId: card.id,
        patientId: patient.id,
      });
      expect(Number(e.feePercent)).toBe(3.5);
    }

    const [expense] = entries.filter((e) => e.type === 'EXPENSE');
    expect(expense).toMatchObject({ category: 'Materiais de procedimento', expenseType: 'VARIABLE' });
    expect(Number(expense.amount)).toBe(2 * 2.5 + 4);
  });

  it('não gera de novo ao reabrir e concluir outra vez', async () => {
    const patient = await makePatient('Reconclui');
    const p = await makeProcedure('Reconclui', 100);
    const appt = await book({ patientId: patient.id, procedureIds: [p.id] });
    await complete(appt.id);
    await as(() => appointments.update(appt.id, { status: AppointmentStatus.SCHEDULED }, C.actor));
    await complete(appt.id);
    expect(await entriesOf(appt.id)).toHaveLength(1);
  });

  it('competência informada define a data do lançamento', async () => {
    const patient = await makePatient('Competência');
    const p = await makeProcedure('Competência', 100);
    const appt = await book({ patientId: patient.id, procedureIds: [p.id] });
    await complete(appt.id, { referenceMonth: '2030-12' });
    const [income] = await entriesOf(appt.id);
    expect(income.paidAt?.toISOString().slice(0, 7)).toBe('2030-12');
  });
});

describe('promoções', () => {
  // promoções valem por data: este bloco usa só 2032 para não afetar os outros
  it('aplica a melhor promoção do dia e grava no agendamento', async () => {
    const patient = await makePatient('Promo');
    const p = await makeProcedure('Promo', 200);
    const pct = await as(() =>
      promotions.create({
        name: `Dez por cento ${suffix}`,
        startAt: '2032-03-01',
        endAt: '2032-03-31',
        discountType: 'PERCENTAGE',
        discountValue: 10,
        procedureIds: [p.id],
      } as never),
    );
    const fixed = await as(() =>
      promotions.create({
        name: `Cinquenta reais ${suffix}`,
        startAt: '2032-03-10',
        endAt: '2032-03-20',
        discountType: 'FIXED',
        discountValue: 50,
        procedureIds: [p.id],
      } as never),
    );

    const preview = await as(() => appointments.promotionPreview(p.id, '2032-03-05'));
    expect(preview).toMatchObject({ finalPrice: 180, discount: 20, promotion: { id: pct.id } });

    const appt = await book({ patientId: patient.id, procedureIds: [p.id], slot: slotOn('2032-03-15') });
    const done = await complete(appt.id);
    expect(done.promotionId).toBe(fixed.id);
    const [income] = await entriesOf(appt.id);
    expect(Number(income.amount)).toBe(150);
    expect(income.description).toContain(`Promoção: Cinquenta reais ${suffix} -R$ 50.00`);

    // fora do período: preço cheio
    const later = await book({ patientId: patient.id, procedureIds: [p.id], slot: slotOn('2032-04-15') });
    await complete(later.id);
    const [full] = await entriesOf(later.id);
    expect(Number(full.amount)).toBe(200);
  });

  it('promoção sem vínculo vale para todos os procedimentos, mas combo exige vínculo e preço', async () => {
    const p = await makeProcedure('Geral', 100);
    await as(() =>
      promotions.create({
        name: `Geral ${suffix}`,
        startAt: '2032-06-01',
        endAt: '2032-06-30',
        discountType: 'PERCENTAGE',
        discountValue: 20,
      } as never),
    );
    const quote = await as(() => appointments.promotionPreview(p.id, '2032-06-10'));
    expect(quote.finalPrice).toBe(80);

    await expect(
      as(() =>
        promotions.create({
          name: `Combo solto ${suffix}`,
          startAt: '2032-06-01',
          endAt: '2032-06-30',
          discountType: 'COMBO',
          discountValue: 50,
        } as never),
      ),
    ).rejects.toThrow('Combo precisa');
    await expect(
      as(() =>
        promotions.create({
          name: `Combo sem preço ${suffix}`,
          startAt: '2032-06-01',
          endAt: '2032-06-30',
          discountType: 'COMBO',
          discountValue: 0,
          procedureIds: [p.id],
        } as never),
      ),
    ).rejects.toThrow('preço do combo');
  });

  it('combo é preço fechado por procedimento, nunca acima do cheio', async () => {
    const patient = await makePatient('Combo');
    const cheap = await makeProcedure('Combo barato', 60);
    const pricey = await makeProcedure('Combo caro', 250);
    await as(() =>
      promotions.create({
        name: `Combo ${suffix}`,
        startAt: '2032-08-01',
        endAt: '2032-08-31',
        discountType: 'COMBO',
        discountValue: 99,
        procedureIds: [cheap.id, pricey.id],
      } as never),
    );
    const appt = await book({ patientId: patient.id, procedureIds: [cheap.id, pricey.id], slot: slotOn('2032-08-05') });
    await complete(appt.id);
    const amounts = (await entriesOf(appt.id)).map((e) => Number(e.amount)).sort((a, b) => a - b);
    expect(amounts).toEqual([60, 99]);
  });
});

describe('venda de pacote e sessões', () => {
  it('venda com pagamento lança receita líquida; sessões concluídas não geram receita de novo', async () => {
    const patient = await makePatient('Pacote pago');
    const p = await makeProcedure('Sessão laser', 200);
    const pix = await as(() => prisma.paymentMethod.create({ data: { name: `Pix ${suffix}`, feePercent: 1 } }));
    const pkg = await as(() =>
      packages.create(
        { name: `Laser 3x ${suffix}`, type: 'SESSIONS', discountPercent: 10, validityDays: 90, items: [{ procedureId: p.id, quantity: 3 }] } as never,
        C.actor,
      ),
    );
    expect(pkg.sessionCount).toBe(3);

    const sold = await as(() =>
      packages.createPatientPackage({ patientId: patient.id, packageId: pkg.id, paymentMethodId: pix.id }, C.actor),
    );
    expect(Number(sold.totalPaid)).toBe(540);
    expect(sold).toMatchObject({ sessionsTotal: 3, sessionsUsed: 0, financeGenerated: true, status: 'ACTIVE' });
    expect(sold.expiresAt).not.toBeNull();
    const sale = await base.financialEntry.findFirstOrThrow({ where: { patientId: patient.id, category: 'Pacotes' } });
    expect([Number(sale.amount), Number(sale.netAmount)]).toEqual([540, 534.6]);

    const ids: string[] = [];
    for (let i = 0; i < 3; i++) {
      const a = await book({ patientId: patient.id, procedureIds: [p.id], patientPackageId: sold.id });
      await complete(a.id);
      ids.push(a.id);
    }
    let pp = await base.patientPackage.findUniqueOrThrow({ where: { id: sold.id } });
    expect(pp).toMatchObject({ sessionsUsed: 3, status: 'COMPLETED' });
    for (const id of ids) expect(await entriesOf(id)).toHaveLength(0);

    // reabrir uma sessão devolve o saldo e reativa o pacote
    await as(() => appointments.update(ids[2], { status: AppointmentStatus.SCHEDULED }, C.actor));
    pp = await base.patientPackage.findUniqueOrThrow({ where: { id: sold.id } });
    expect(pp).toMatchObject({ sessionsUsed: 2, status: 'ACTIVE' });

    // excluir sessão concluída também devolve
    await as(() => appointments.remove(ids[1], C.actor));
    pp = await base.patientPackage.findUniqueOrThrow({ where: { id: sold.id } });
    expect(pp.sessionsUsed).toBe(1);

    // número da sessão considera todas do pacote
    const listed = await as(() => appointments.list('2030-01-01T00:00:00Z', '2031-12-31T00:00:00Z'));
    const idx = listed.filter((a) => a.patientPackageId === sold.id).map((a) => a.sessionIndex);
    expect(idx).toEqual([1, 2]);
  });

  it('venda sem pagamento: a primeira sessão concluída lança o valor do pacote uma vez só', async () => {
    const patient = await makePatient('Pacote a prazo');
    const p = await makeProcedure('Sessão drenagem', 100);
    const pkg = await as(() =>
      packages.create({ name: `Drenagem ${suffix}`, type: 'SESSIONS', totalPrice: 250, items: [{ procedureId: p.id, quantity: 3 }] } as never),
    );
    const sold = await as(() => packages.createPatientPackage({ patientId: patient.id, packageId: pkg.id }));
    expect(sold.financeGenerated).toBe(false);

    const a1 = await book({ patientId: patient.id, procedureIds: [p.id], patientPackageId: sold.id });
    await complete(a1.id);
    const a2 = await book({ patientId: patient.id, procedureIds: [p.id], patientPackageId: sold.id });
    await complete(a2.id);

    const [first] = await entriesOf(a1.id);
    expect(first).toMatchObject({ category: 'Pacotes' });
    expect(Number(first.amount)).toBe(250);
    expect(await entriesOf(a2.id)).toHaveLength(0);
    expect((await base.patientPackage.findUniqueOrThrow({ where: { id: sold.id } })).financeGenerated).toBe(true);
  });

  it('pacote combo cobre só os procedimentos dele; o resto do agendamento é cobrado avulso', async () => {
    const patient = await makePatient('Combo pacote');
    const inPkg = await makeProcedure('No pacote', 100);
    const alsoInPkg = await makeProcedure('Também no pacote', 100);
    const outside = await makeProcedure('Fora do pacote', 70);
    const pkg = await as(() =>
      packages.create({
        name: `Combo pele ${suffix}`,
        type: 'COMBO',
        totalPrice: 150,
        items: [
          { procedureId: inPkg.id, quantity: 1 },
          { procedureId: alsoInPkg.id, quantity: 1 },
        ],
      } as never),
    );
    const sold = await as(() => packages.createPatientPackage({ patientId: patient.id, packageId: pkg.id }));
    const appt = await book({ patientId: patient.id, procedureIds: [inPkg.id, outside.id], patientPackageId: sold.id });
    await complete(appt.id);

    const entries = await entriesOf(appt.id);
    expect(entries.map((e) => [e.category, Number(e.amount)]).sort()).toEqual(
      [
        ['Atendimentos', 70],
        ['Pacotes', 150],
      ].sort(),
    );
  });

  it('promoção vinculada ao pacote entra no preço de venda e no lançamento', async () => {
    const patient = await makePatient('Pacote promo');
    const p = await makeProcedure('Pacote promo', 100);
    const card = await as(() => prisma.paymentMethod.create({ data: { name: `Débito ${suffix}`, feePercent: 0 } }));
    const pkg = await as(() =>
      packages.create({ name: `Promo pacote ${suffix}`, type: 'SESSIONS', items: [{ procedureId: p.id, quantity: 4 }] } as never),
    );
    await as(() =>
      promotions.create({
        name: `Black ${suffix}`,
        // vigente hoje em qualquer fuso (a cotação usa o dia de Brasília)
        startAt: '2020-01-01',
        endAt: '2099-12-31',
        discountType: 'FIXED',
        discountValue: 100,
        packageIds: [pkg.id],
      } as never),
    );
    const quote = await as(() => packages.saleQuote(pkg.id));
    expect(quote).toMatchObject({ originalPrice: 400, finalPrice: 300 });

    const sold = await as(() =>
      packages.createPatientPackage({ patientId: patient.id, packageId: pkg.id, paymentMethodId: card.id }),
    );
    expect(Number(sold.totalPaid)).toBe(300);
    const sale = await base.financialEntry.findFirstOrThrow({ where: { patientId: patient.id, category: 'Pacotes' } });
    expect(sale.description).toContain(`Promoção: Black ${suffix}`);

    // valor combinado à mão diferente do promocional não leva o nome da promoção
    const manual = await as(() =>
      packages.createPatientPackage({ patientId: patient.id, packageId: pkg.id, paymentMethodId: card.id, totalPaid: 280 }),
    );
    const manualSale = await base.financialEntry.findFirstOrThrow({
      where: { patientId: patient.id, category: 'Pacotes', amount: 280 },
    });
    expect(Number(manual.totalPaid)).toBe(280);
    expect(manualSale.description).not.toContain('Promoção');
  });

  it('recusa pacote de outra paciente e pagamento antecipado de valor zero', async () => {
    const owner = await makePatient('Dona');
    const other = await makePatient('Outra');
    const p = await makeProcedure('Pacote alheio', 100);
    const pm = await as(() => prisma.paymentMethod.create({ data: { name: `Dinheiro ${suffix}` } }));
    const pkg = await as(() =>
      packages.create({ name: `Alheio ${suffix}`, type: 'SESSIONS', items: [{ procedureId: p.id, quantity: 1 }] } as never),
    );
    const sold = await as(() => packages.createPatientPackage({ patientId: owner.id, packageId: pkg.id }));

    await expect(
      book({ patientId: other.id, procedureIds: [p.id], patientPackageId: sold.id }),
    ).rejects.toThrow('não pertence a este paciente');
    await expect(
      as(() => packages.createPatientPackage({ patientId: owner.id, packageId: pkg.id, paymentMethodId: pm.id, totalPaid: 0 })),
    ).rejects.toThrow('maior que zero');
  });
});
