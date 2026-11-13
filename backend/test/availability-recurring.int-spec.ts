/** Disponibilidade dos profissionais e despesas recorrentes com Nest + Postgres reais (datas fixas). */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';

import { AppModule } from '../src/app.module';
import { AvailabilityService } from '../src/availability/availability.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { RecurringExpensesService } from '../src/recurring-expenses/recurring-expenses.service';
import { createTestClinic, purgeTenants, testSuffix, TestClinic } from './helpers/test-clinic';

jest.setTimeout(60_000);

const suffix = testSuffix();
const base = new PrismaClient();
const MISSING = '00000000-0000-0000-0000-000000000000';

let moduleRef: TestingModule;
let prisma: PrismaService;
let availability: AvailabilityService;
let recurring: RecurringExpensesService;
let C: TestClinic;
const as = <T>(fn: () => Promise<T>) => C.as(fn);
const at = (iso: string) => new Date(iso);

beforeAll(async () => {
  moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  prisma = moduleRef.get(PrismaService);
  availability = moduleRef.get(AvailabilityService);
  recurring = moduleRef.get(RecurringExpensesService);
  C = await createTestClinic(base, 'Disponibilidade', suffix);
});

afterAll(async () => {
  await new Promise((r) => setTimeout(r, 500));
  if (C) await purgeTenants(base, [C.tenant.id]);
  await moduleRef?.close();
  await base.$disconnect();
});

describe('expediente e indisponibilidade', () => {
  it('grava, atualiza e remove o expediente validando o intervalo', async () => {
    const id = C.admin.id;
    await expect(as(() => availability.upsertWorkingHours(id, { dayOfWeek: 1, startTime: '10:00', endTime: '09:00' }))).rejects.toBeInstanceOf(BadRequestException);
    await as(() => availability.upsertWorkingHours(id, { dayOfWeek: 1, startTime: '08:00', endTime: '12:00' }));
    const upd = await as(() => availability.upsertWorkingHours(id, { dayOfWeek: 1, startTime: '09:00', endTime: '12:00' }));
    expect(upd.startTime).toBe('09:00');
    await as(() => availability.upsertWorkingHours(id, { dayOfWeek: 2, startTime: '09:00', endTime: '12:00' }));
    expect((await as(() => availability.listWorkingHours(id))).map((w) => w.dayOfWeek)).toEqual([1, 2]);
    expect(await as(() => availability.removeWorkingHours(id, 2))).toEqual({ ok: true });
    expect(await as(() => availability.listWorkingHours(id))).toHaveLength(1);
  });

  it('cria, lista e remove indisponibilidades', async () => {
    const id = C.admin.id;
    await expect(as(() => availability.createUnavailability(id, { startAt: '2031-02-02T12:00:00Z', endAt: '2031-02-02T10:00:00Z' }))).rejects.toThrow('anterior ao fim');
    const ua = await as(() => availability.createUnavailability(id, { startAt: '2031-02-03T12:00:00Z', endAt: '2031-02-03T20:00:00Z', reason: 'Curso' }));
    expect((await as(() => availability.listUnavailability(id))).map((u) => u.id)).toContain(ua.id);
    const inRange = await as(() => availability.listUnavailabilityInRange('2031-02-03T00:00:00Z', '2031-02-04T00:00:00Z'));
    expect(inRange.map((u) => u.id)).toContain(ua.id);
    expect(await as(() => availability.listUnavailabilityInRange('2031-02-03T00:00:00Z', '2031-02-04T00:00:00Z', MISSING))).toEqual([]);

    await expect(as(() => availability.removeUnavailability(MISSING, ua.id))).rejects.toBeInstanceOf(NotFoundException);
    await expect(as(() => availability.removeUnavailability(id, MISSING))).rejects.toBeInstanceOf(NotFoundException);
    expect(await as(() => availability.removeUnavailability(id, ua.id))).toEqual({ ok: true });
  });

  it('valida horários: folga, dia sem expediente, fora do expediente e conflito', async () => {
    const pro = await base.user.create({
      data: { name: `Pro ${suffix}`, email: `pro-${suffix}@fluxos.test`, password: 'x', tenantId: C.tenant.id, roleId: C.adminRole.id },
    });
    const patient = await as(() => prisma.patient.create({ data: { name: `Pac ${suffix}` } }));
    // 2031-03-03 é segunda-feira; expediente 09:00-12:00 de Brasília (12:00Z-15:00Z)
    await as(() => availability.upsertWorkingHours(pro.id, { dayOfWeek: 1, startTime: '09:00', endTime: '12:00' }));
    await as(() => availability.createUnavailability(pro.id, { startAt: '2031-03-10T12:00:00Z', endAt: '2031-03-10T15:00:00Z' }));
    const check = (s: string, e: string, exclude?: string) => as(() => availability.checkProfessionalSlot(pro.id, at(s), at(e), exclude));

    await expect(check('2031-03-03T13:00:00Z', '2031-03-03T14:00:00Z')).resolves.toBeUndefined();
    await expect(check('2031-03-10T13:00:00Z', '2031-03-10T14:00:00Z')).rejects.toThrow('indisponível no período (motivo: folga)');
    await expect(check('2031-03-04T13:00:00Z', '2031-03-04T14:00:00Z')).rejects.toThrow('não atende neste dia');
    await expect(check('2031-03-03T11:00:00Z', '2031-03-03T12:30:00Z')).rejects.toThrow('fora do expediente');
    await expect(check('2031-03-03T14:00:00Z', '2031-03-03T16:00:00Z')).rejects.toThrow('fora do expediente');

    const appt = await as(() =>
      prisma.appointment.create({ data: { patientId: patient.id, professionalId: pro.id, startAt: at('2031-03-03T13:00:00Z'), endAt: at('2031-03-03T14:00:00Z'), status: 'CONFIRMED' } }),
    );
    await expect(check('2031-03-03T13:30:00Z', '2031-03-03T14:30:00Z')).rejects.toThrow('outro agendamento');
    await expect(check('2031-03-03T13:30:00Z', '2031-03-03T14:30:00Z', appt.id)).resolves.toBeUndefined();

    const free = await as(() => availability.listAvailableProfessionals('2031-03-03T13:00:00Z', '2031-03-03T14:00:00Z'));
    expect(free.map((p) => p.id)).toContain(C.admin.id);
    expect(free.map((p) => p.id)).not.toContain(pro.id);
    await expect(as(() => availability.listAvailableProfessionals('2031-03-03T14:00:00Z', '2031-03-03T13:00:00Z'))).rejects.toBeInstanceOf(BadRequestException);
    await expect(as(() => availability.listAvailableProfessionals('lixo', '2031-03-03T13:00:00Z'))).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('despesas recorrentes', () => {
  it('cadastra, edita, remove e gera lançamentos do mês sem duplicar', async () => {
    const rent = await as(() => recurring.create({ name: `Aluguel ${suffix}`, amount: 2000, expenseType: 'FIXED', dueDay: 31, category: 'Fixas', description: 'x' }, C.actor));
    const off = await as(() => recurring.create({ name: `Inativa ${suffix}`, amount: 10, expenseType: 'VARIABLE', dueDay: 5, active: false }));
    const tmp = await as(() => recurring.create({ name: `Temp ${suffix}`, amount: 10, expenseType: 'VARIABLE', dueDay: 5 }));
    expect((await as(() => recurring.list())).map((r) => r.id)).toEqual(expect.arrayContaining([rent.id, off.id]));

    const upd = await as(() => recurring.update(rent.id, { amount: 2500 }, C.actor));
    expect(Number(upd.amount)).toBe(2500);
    expect(await as(() => recurring.remove(tmp.id, C.actor))).toEqual({ ok: true, unlinked: [] });
    await expect(as(() => recurring.findOne(tmp.id))).rejects.toBeInstanceOf(NotFoundException);

    // fevereiro/2031 tem 28 dias: vencimento dia 31 vira 28
    const first = await as(() => recurring.generateForMonth(2031, 2));
    expect(first.month).toBe('2031-02');
    expect(first.items).toContain(`Aluguel ${suffix}`);
    expect(first.items).not.toContain(`Inativa ${suffix}`);
    const entry = await base.financialEntry.findFirstOrThrow({ where: { recurringExpenseId: rent.id } });
    expect(entry.dueDate?.getDate()).toBe(28);
    const second = await as(() => recurring.generateForMonth(2031, 2));
    expect(second.items).not.toContain(`Aluguel ${suffix}`);
  });

  it('configura e consulta o custo/hora', async () => {
    expect(await as(() => recurring.getHourlyCostSettings())).toEqual({ includeVariable: expect.any(Boolean) });
    await as(() => recurring.setHourlyCostSettings(true));
    expect(await as(() => recurring.getHourlyCostSettings())).toEqual({ includeVariable: true });
    const summary = await as(() => recurring.getHourlyCostSummary());
    expect(summary).toHaveProperty('hourlyCost');
    const explicit = await as(() => recurring.getHourlyCostSummary(false));
    expect(explicit).toHaveProperty('hourlyCost');
  });
});
