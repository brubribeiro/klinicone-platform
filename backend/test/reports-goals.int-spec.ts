/**
 * Relatórios (métricas) e metas com Nest + Postgres reais, sobre um período fixo (janeiro/2031)
 * para não depender da data de hoje nem do fuso do servidor.
 */
import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppointmentKind, AppointmentStatus, PrismaClient } from '@prisma/client';

import { AppModule } from '../src/app.module';
import { AppointmentsService } from '../src/appointments/appointments.service';
import { GoalsService } from '../src/goals/goals.service';
import { MetricsService } from '../src/metrics/metrics.service';
import { PackagesService } from '../src/packages/packages.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestClinic, purgeTenants, testSuffix, TestClinic } from './helpers/test-clinic';

jest.setTimeout(60_000);

const suffix = testSuffix();
const base = new PrismaClient();

let moduleRef: TestingModule;
let prisma: PrismaService;
let appointments: AppointmentsService;
let packages: PackagesService;
let goals: GoalsService;
let metrics: MetricsService;
let C: TestClinic;
let secondPro: { id: string };

const as = <T>(fn: () => Promise<T>) => C.as(fn);

function slot(day: string, hour: number, minutes = 60) {
  const start = new Date(`${day}T${String(hour).padStart(2, '0')}:00:00.000Z`);
  return { startAt: start.toISOString(), endAt: new Date(start.getTime() + minutes * 60_000).toISOString() };
}

beforeAll(async () => {
  moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  prisma = moduleRef.get(PrismaService);
  appointments = moduleRef.get(AppointmentsService);
  packages = moduleRef.get(PackagesService);
  goals = moduleRef.get(GoalsService);
  metrics = moduleRef.get(MetricsService);
  C = await createTestClinic(base, 'Relatorios', suffix);

  const pro = await base.user.create({
    data: {
      name: 'Profissional Dois',
      email: `pro2-${suffix}@fluxos.test`,
      password: 'x',
      tenantId: C.tenant.id,
      roleId: C.adminRole.id,
    },
  });
  secondPro = pro;
  // dados de janeiro/2031
  const lim = await as(() => prisma.procedure.create({ data: { name: `Limpeza ${suffix}`, price: 100, durationMinutes: 60 } }));
  const pee = await as(() => prisma.procedure.create({ data: { name: `Peeling ${suffix}`, price: 300, durationMinutes: 30 } }));
  await as(() => prisma.procedure.create({ data: { name: `Inativo ${suffix}`, price: 10, active: false } }));
  const item = await as(() => prisma.inventoryItem.create({ data: { name: `Insumo ${suffix}`, quantity: 100, costPrice: 2 } }));
  await as(() => prisma.procedureMaterial.create({ data: { procedureId: lim.id, itemId: item.id, quantity: 2 } }));

  const old = await as(() =>
    prisma.patient.create({
      data: { name: `Antiga ${suffix}`, birthDate: new Date('1990-05-10'), address: 'Rua A, Sorocaba - SP', createdAt: new Date('2030-06-01') },
    }),
  );
  const fresh = await as(() =>
    prisma.patient.create({ data: { name: `Nova ${suffix}`, birthDate: new Date('1985-01-01'), createdAt: new Date('2031-01-03') } }),
  );
  const fresh2 = await as(() => prisma.patient.create({ data: { name: `Nova2 ${suffix}`, createdAt: new Date('2031-01-04') } }));

  const book = (
    patientId: string,
    procedureIds: string[],
    when: { startAt: string; endAt: string },
    professionalId = C.admin.id,
    kind: AppointmentKind = AppointmentKind.PROCEDURE,
  ) => as(() => appointments.create({ patientId, procedureIds, kind, professionalId, ...when }, C.actor));
  const setStatus = (id: string, status: AppointmentStatus) =>
    as(() => appointments.update(id, { status }, C.actor));

  // antes do período: a paciente antiga já tinha atendimento concluído (retorno)
  const past = await book(old.id, [lim.id], slot('2030-12-10', 13));
  await setStatus(past.id, AppointmentStatus.COMPLETED);

  const a1 = await book(old.id, [lim.id, pee.id], slot('2031-01-08', 13, 90));
  await as(() => appointments.update(a1.id, { status: AppointmentStatus.COMPLETED }, C.actor));
  await base.appointment.update({
    where: { id: a1.id },
    data: { startedAt: new Date('2031-01-08T13:00:00Z'), finishedAt: new Date('2031-01-08T14:20:00Z') },
  });
  const a2 = await book(fresh.id, [pee.id], slot('2031-01-09', 15, 30), secondPro.id);
  await setStatus(a2.id, AppointmentStatus.COMPLETED);
  const a3 = await book(fresh2.id, [lim.id], slot('2031-01-10', 14));
  await setStatus(a3.id, AppointmentStatus.CANCELLED);
  const a4 = await book(fresh2.id, [lim.id], slot('2031-01-14', 14));
  await setStatus(a4.id, AppointmentStatus.NO_SHOW);
  const a5 = await book(fresh2.id, [lim.id], slot('2031-01-15', 16));
  await setStatus(a5.id, AppointmentStatus.CONFIRMED);
  await book(fresh2.id, [], slot('2031-01-16', 16), C.admin.id, AppointmentKind.EVALUATION);
  await book(old.id, [lim.id], slot('2031-01-21', 13));

  // expediente definido só depois, porque a agenda recusa horários fora dele
  await base.financialEntry.create({
    data: { type: 'INCOME', description: 'Receita fixa', amount: 500, paidAt: new Date('2031-01-10T15:00:00Z'), tenantId: C.tenant.id },
  });
  // terças (dia 2) e quartas (dia 3) das 08:00 às 18:00 para o admin; terças para o segundo
  await base.workingHours.createMany({
    data: [
      { userId: C.admin.id, dayOfWeek: 2, startTime: '08:00', endTime: '18:00', tenantId: C.tenant.id },
      { userId: C.admin.id, dayOfWeek: 3, startTime: '08:00', endTime: '18:00', tenantId: C.tenant.id },
      { userId: pro.id, dayOfWeek: 2, startTime: '09:00', endTime: '12:00', tenantId: C.tenant.id },
    ],
  });
  await base.unavailability.create({
    data: {
      userId: C.admin.id,
      tenantId: C.tenant.id,
      startAt: new Date('2031-01-07T11:00:00Z'),
      endAt: new Date('2031-01-07T21:00:00Z'),
      reason: 'Folga',
    },
  });

  const pkg = await as(() =>
    packages.create({ name: `Pacote ${suffix}`, type: 'SESSIONS', totalPrice: 400, items: [{ procedureId: lim.id, quantity: 4 }] } as never, C.actor),
  );
  const sold = await as(() => packages.createPatientPackage({ patientId: old.id, packageId: pkg.id }, C.actor));
  await base.patientPackage.update({ where: { id: sold.id }, data: { purchaseDate: new Date('2031-01-05T12:00:00Z') } });
});

afterAll(async () => {
  await new Promise((r) => setTimeout(r, 500));
  if (C) await purgeTenants(base, [C.tenant.id]);
  await moduleRef?.close();
  await base.$disconnect();
});

describe('métricas', () => {
  it('consolida agendamentos, pacientes, procedimentos e pacotes do período', async () => {
    const r = await as(() => metrics.getMetrics({ from: '2031-01-01', to: '2031-01-31' }));

    expect(r.appointments.total).toBe(7);
    expect(r.appointments.completed).toBe(2);
    expect(r.appointments.cancelled).toBe(1);
    expect(r.appointments.noShow).toBe(1);
    expect(r.appointments.confirmed).toBe(1);
    expect(r.appointments.scheduled).toBe(2);
    expect(r.appointments.byProfessional.map((p) => p.name)).toEqual(
      expect.arrayContaining(['Profissional Dois']),
    );
    expect(r.appointments.byProcedure.length).toBeGreaterThan(0);
    expect(r.appointments.byHour.length).toBeGreaterThan(0);
    expect(r.appointments.byDayOfWeek.length).toBeGreaterThan(0);

    expect(r.patients.newInPeriod).toBe(2);
    expect(r.patients.totalActive).toBeGreaterThanOrEqual(3);
    expect(r.patients.topPatients.length).toBeGreaterThan(0);

    expect(r.procedures.totalCatalog).toBe(3);
    expect(r.procedures.activeCatalog).toBe(2);
    expect(r.procedures.totalPerformed).toBeGreaterThan(0);
    expect(r.procedures.ranking.length).toBeGreaterThan(0);
    expect(r.procedures.materialCost.length).toBeGreaterThan(0);
    expect(r.procedures.averageRealDuration).toBe(80);

    expect(r.packages.totalSold).toBe(1);
    expect(r.packages.totalRevenue).toBe(400);
  });

  it('período vazio devolve zeros sem quebrar', async () => {
    const r = await as(() => metrics.getMetrics({ from: '2040-01-01', to: '2040-01-31' }));
    expect(r.appointments.total).toBe(0);
    expect(r.appointments.completionRate).toBe(0);
    expect(r.patients.averageAge === null || typeof r.patients.averageAge === 'number').toBe(true);
    expect(r.packages.totalSold).toBe(0);
  });
});

describe('metas', () => {
  const mk = (over: Record<string, unknown>) =>
    as(() =>
      goals.create(
        { name: 'Meta', metric: 'MANUAL', target: 100, periodType: 'MONTH', periodStart: '2031-01-15', ...over } as never,
        C.actor,
      ),
    );

  it('cria meta manual, normaliza o início do período e calcula progresso', async () => {
    const g = await mk({ name: ' Manual ', manualValue: 25, format: 'NUMBER', color: '#112233' });
    expect(g).toMatchObject({ name: 'Manual', periodStart: '2031-01-01', periodEnd: '2031-01-31', currentValue: 25, progress: 25, color: '#112233' });

    const upd = await as(() => goals.update(g.id, { manualValue: 50, target: 200 } as never, C.actor));
    expect(upd).toMatchObject({ currentValue: 50, target: 200, progress: 25 });

    const one = await as(() => goals.findOne(g.id));
    expect(one.id).toBe(g.id);
  });

  it('calcula todos os indicadores automáticos no mês e no trimestre/ano', async () => {
    const out: Record<string, number> = {};
    for (const metric of ['REVENUE', 'NEW_PATIENTS', 'PROCEDURES', 'AVERAGE_TICKET', 'OCCUPANCY', 'RETURN_RATE']) {
      const g = await mk({ name: metric, metric, periodType: 'MONTH' });
      out[metric] = g.currentValue;
      expect(g.manualValue).toBeNull();
    }
    expect(out.NEW_PATIENTS).toBe(2);
    expect(out.PROCEDURES).toBe(2);
    expect(out.REVENUE).toBeGreaterThan(0);
    expect(out.AVERAGE_TICKET).toBeGreaterThan(0);
    expect(out.OCCUPANCY).toBeGreaterThan(0);
    expect(out.RETURN_RATE).toBe(50);

    const q = await mk({ name: 'Trim', metric: 'NEW_PATIENTS', periodType: 'QUARTER', periodStart: '2031-02-20' });
    expect(q).toMatchObject({ periodStart: '2031-01-01', periodEnd: '2031-03-31' });
    const y = await mk({ name: 'Ano', metric: 'REVENUE', periodType: 'YEAR', periodStart: '2031-08-20' });
    expect(y).toMatchObject({ periodStart: '2031-01-01', periodEnd: '2031-12-31' });
  });

  it('prévia sem salvar e metas manuais sem valor', async () => {
    expect(await as(() => goals.preview('MANUAL', 'MONTH', '2031-01-01'))).toEqual({ currentValue: null });
    const p = await as(() => goals.preview('NEW_PATIENTS', 'MONTH', '2031-01-20'));
    expect(p.currentValue).toBe(2);
  });

  it('filtra por escopo e por data', async () => {
    const past = await mk({ name: 'Passada', periodStart: '2020-03-01' });
    const future = await mk({ name: 'Futura', periodStart: '2090-03-01' });
    const ids = (l: { id: string }[]) => l.map((x) => x.id);

    expect(ids(await as(() => goals.list('past')))).toContain(past.id);
    expect(ids(await as(() => goals.list('past')))).not.toContain(future.id);
    expect(ids(await as(() => goals.list('upcoming')))).toContain(future.id);
    expect(ids(await as(() => goals.list('all')))).toEqual(expect.arrayContaining([past.id, future.id]));
    expect(ids(await as(() => goals.list('current')))).not.toContain(past.id);
    expect(ids(await as(() => goals.list('all', '2020-03-15')))).toEqual([past.id]);
    // `at` inválido cai para hoje
    expect(ids(await as(() => goals.list('current', 'lixo')))).not.toContain(past.id);
  });

  it('remove e recusa metas inexistentes', async () => {
    const g = await mk({ name: 'Descartável' });
    expect(await as(() => goals.remove(g.id, C.actor))).toEqual({ ok: true });
    const missing = '00000000-0000-0000-0000-000000000000';
    await expect(as(() => goals.findOne(missing))).rejects.toBeInstanceOf(NotFoundException);
    await expect(as(() => goals.update(missing, {} as never))).rejects.toBeInstanceOf(NotFoundException);
    await expect(as(() => goals.remove(missing))).rejects.toBeInstanceOf(NotFoundException);
  });
});
