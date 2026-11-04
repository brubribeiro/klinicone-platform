/**
 * Modelos de mensagem, fila de envios automáticos de WhatsApp e rotinas do scheduler
 * (estoque vencendo, retorno, reativação, manutenção de equipamento) com Nest + Postgres reais.
 */
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';

import { AppModule } from '../src/app.module';
import { getBrazilYmd } from '../src/common/utils/brazil-time.util';
import { MessageDispatchService } from '../src/messages/message-dispatch.service';
import { MessagesService } from '../src/messages/messages.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { SchedulerService } from '../src/scheduler/scheduler.service';
import { createTestClinic, purgeTenants, testSuffix, TestClinic } from './helpers/test-clinic';

jest.setTimeout(60_000);

const suffix = testSuffix();
const base = new PrismaClient();
const MISSING = '00000000-0000-0000-0000-000000000000';
const DAY = 86_400_000;

let moduleRef: TestingModule;
let prisma: PrismaService;
let messages: MessagesService;
let dispatch: MessageDispatchService;
let scheduler: SchedulerService;
let C: TestClinic;

const as = <T>(fn: () => Promise<T>) => C.as(fn);

beforeAll(async () => {
  moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  prisma = moduleRef.get(PrismaService);
  messages = moduleRef.get(MessagesService);
  dispatch = moduleRef.get(MessageDispatchService);
  scheduler = moduleRef.get(SchedulerService);
  C = await createTestClinic(base, 'Mensagens', suffix);
});

afterAll(async () => {
  await new Promise((r) => setTimeout(r, 500));
  if (C) await purgeTenants(base, [C.tenant.id]);
  scheduler.onModuleDestroy();
  await moduleRef?.close();
  await base.$disconnect();
});

describe('modelos de mensagem', () => {
  it('cria, lista, edita, impede nome duplicado e remove', async () => {
    const t = await as(() => messages.create({ name: `Modelo ${suffix}`, content: 'Oi {{paciente_nome}}' }, C.actor));
    expect(t.trigger).toBe('MANUAL');
    await expect(as(() => messages.create({ name: `Modelo ${suffix}`, content: 'x' }))).rejects.toBeInstanceOf(ConflictException);
    const other = await as(() => messages.create({ name: `Outro ${suffix}`, content: 'y' }));

    expect((await as(() => messages.list())).map((m) => m.id)).toEqual(expect.arrayContaining([t.id, other.id]));
    expect((await as(() => messages.findOne(t.id))).id).toBe(t.id);

    const upd = await as(() => messages.update(t.id, { name: `Modelo ${suffix}`, content: 'novo', active: false }, C.actor));
    expect(upd).toMatchObject({ content: 'novo', active: false });
    await expect(as(() => messages.update(t.id, { name: `Outro ${suffix}` }))).rejects.toBeInstanceOf(ConflictException);

    expect(await as(() => messages.remove(other.id, C.actor))).toEqual({ ok: true });
    await expect(as(() => messages.findOne(other.id))).rejects.toBeInstanceOf(NotFoundException);
  });

  it('registra envio manual e marca envios como enviados', async () => {
    const tpl = await as(() => messages.create({ name: `Manual ${suffix}`, content: 'Oi' }));
    const patient = await as(() => prisma.patient.create({ data: { name: `Manual ${suffix}`, phone: '15999998888' } }));

    const withPhone = await as(() =>
      dispatch.recordManualSend({ templateId: tpl.id, patientId: patient.id, phone: ' 15999998888 ', renderedMessage: 'Oi' }),
    );
    expect(withPhone).toMatchObject({ status: 'SENT', source: 'MANUAL' });
    expect(withPhone.waMeUrl).toContain('wa.me');
    const noPhone = await as(() =>
      dispatch.recordManualSend({ templateId: tpl.id, patientId: patient.id, phone: '  ', renderedMessage: 'Oi' }),
    );
    expect(noPhone.waMeUrl).toBeNull();
    await expect(
      as(() => dispatch.recordManualSend({ templateId: MISSING, patientId: patient.id, renderedMessage: 'x' })),
    ).rejects.toBeInstanceOf(NotFoundException);

    const pending = await as(() =>
      prisma.messageDispatch.create({
        data: { templateId: tpl.id, patientId: patient.id, trigger: 'MANUAL', dedupKey: `k-${suffix}`, renderedMessage: 'x', status: 'PENDING', source: 'AUTO' },
      }),
    );
    expect((await as(() => dispatch.listPending())).map((d) => d.id)).toContain(pending.id);
    const sent = await as(() => dispatch.markSent(pending.id));
    expect(sent.status).toBe('SENT');
    expect((await as(() => dispatch.markSent(pending.id))).status).toBe('SENT');
    await expect(as(() => dispatch.markSent(MISSING))).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('gatilhos automáticos', () => {
  it('enfileira por gatilho, ignora sem telefone e não duplica', async () => {
    const mk = (name: string, trigger: string, procedureId?: string) =>
      as(() => messages.create({ name: `${name} ${suffix}`, content: 'Olá {{paciente_nome}} da {{clinica}}', trigger: trigger as never, procedureId }));
    const proc = await as(() => prisma.procedure.create({ data: { name: `Proc ${suffix}`, price: 10 } }));
    const otherProc = await as(() => prisma.procedure.create({ data: { name: `Outro ${suffix}`, price: 10 } }));
    const tpls = [
      await mk('Agendou', 'ON_BOOKING'),
      await mk('Agendou outro', 'ON_BOOKING', otherProc.id),
      await mk('Véspera', 'DAY_BEFORE'),
      await mk('Aniversário', 'BIRTHDAY'),
      await mk('Aniversário proc', 'BIRTHDAY', proc.id),
      await mk('Pós', 'AFTER_APPOINTMENT'),
      await mk('Inativo', 'INACTIVE_90_DAYS'),
      await mk('Inativo proc', 'INACTIVE_90_DAYS', otherProc.id),
    ];
    expect(tpls).toHaveLength(8);

    const { m, d } = getBrazilYmd();
    const withPhone = await as(() =>
      prisma.patient.create({ data: { name: `Maria Silva ${suffix}`, phone: '15999990000', birthDate: new Date(Date.UTC(1990, m - 1, d, 12)) } }),
    );
    const noPhone = await as(() => prisma.patient.create({ data: { name: `Sem Fone ${suffix}` } }));
    const inactive = await as(() => prisma.patient.create({ data: { name: `Inativa ${suffix}`, phone: '15999991111' } }));

    const mkAppt = (patientId: string, startAt: Date, status: string, extra: Record<string, unknown> = {}) =>
      as(() =>
        prisma.appointment.create({
          data: { patientId, professionalId: C.admin.id, procedureId: proc.id, startAt, endAt: new Date(startAt.getTime() + 3600_000), status: status as never, ...extra },
        }),
      );
    // reserva futura recém-criada (ON_BOOKING)
    await mkAppt(withPhone.id, new Date(Date.now() + 40 * DAY), 'SCHEDULED');
    await mkAppt(noPhone.id, new Date(Date.now() + 41 * DAY), 'CONFIRMED');
    // amanhã (DAY_BEFORE): meio-dia de Brasília do dia seguinte
    const tomorrow = new Date(Date.now() + DAY);
    const t = getBrazilYmd(tomorrow);
    await mkAppt(withPhone.id, new Date(`${t.iso}T12:00:00-03:00`), 'SCHEDULED');
    // concluído agora (AFTER_APPOINTMENT)
    await mkAppt(withPhone.id, new Date(Date.now() - 3600_000), 'COMPLETED', { finishedAt: new Date() });
    // paciente inativa: único atendimento concluído há 200 dias
    await mkAppt(inactive.id, new Date(Date.now() - 200 * DAY), 'COMPLETED', { procedureId: otherProc.id });

    await as(() => dispatch.processAutoTriggers(`Clínica ${suffix}`));
    const rows = await base.messageDispatch.findMany({ where: { tenantId: C.tenant.id, source: 'AUTO' } });
    const count = (trigger: string) => rows.filter((r) => r.trigger === trigger).length;

    // ON_BOOKING: 2 agendamentos × 1 modelo sem filtro; modelo filtrado por outro procedimento não casa
    expect(count('ON_BOOKING')).toBeGreaterThanOrEqual(2);
    expect(rows.some((r) => r.trigger === 'ON_BOOKING' && r.status === 'SKIPPED')).toBe(true);
    expect(count('DAY_BEFORE')).toBe(1);
    expect(count('BIRTHDAY')).toBe(1);
    expect(count('AFTER_APPOINTMENT')).toBe(1);
    expect(count('INACTIVE_90_DAYS')).toBe(2);
    expect(rows.find((r) => r.trigger === 'BIRTHDAY')?.renderedMessage).toContain('Maria');

    // segunda rodada não duplica (P2002 tratado)
    await as(() => dispatch.processAutoTriggers(`Clínica ${suffix}`));
    expect(await base.messageDispatch.count({ where: { tenantId: C.tenant.id, source: 'AUTO' } })).toBe(rows.length);
  });

  it('sem modelos automáticos ativos não faz nada', async () => {
    await as(() => prisma.messageTemplate.updateMany({ data: { active: false } }));
    const before = await base.messageDispatch.count({ where: { tenantId: C.tenant.id } });
    await as(() => dispatch.processAutoTriggers('x'));
    expect(await base.messageDispatch.count({ where: { tenantId: C.tenant.id } })).toBe(before);
  });
});

describe('scheduler', () => {
  it('gera notificações de estoque, retorno, reativação e manutenção sem duplicar', async () => {
    await as(() => prisma.messageTemplate.updateMany({ data: { active: false } }));
    const proc = await as(() => prisma.procedure.create({ data: { name: `Retorno ${suffix}`, price: 10, recurrenceDays: 30 } }));
    const patient = await as(() => prisma.patient.create({ data: { name: `Retorna ${suffix}` } }));
    await as(() =>
      prisma.appointment.create({
        data: {
          patientId: patient.id,
          professionalId: C.admin.id,
          procedureId: proc.id,
          startAt: new Date(Date.now() - 200 * DAY),
          endAt: new Date(Date.now() - 200 * DAY + 3600_000),
          status: 'COMPLETED',
        },
      }),
    );
    await as(() =>
      prisma.inventoryItem.create({ data: { name: `Vencendo ${suffix}`, quantity: 2, expiresAt: new Date(Date.now() + 3 * DAY), expiryNotifyDaysBefore: 10 } }),
    );
    await as(() =>
      prisma.inventoryItem.create({ data: { name: `Vencido ${suffix}`, quantity: 2, expiresAt: new Date(Date.now() - 3 * DAY), expiryNotifyDaysBefore: 10 } }),
    );
    await as(() =>
      prisma.equipment.create({
        data: { name: `Equip ${suffix}`, maintenanceNotifyDaysBefore: 10, scheduledMaintenanceAt: new Date(Date.now() + 2 * DAY) },
      }),
    );

    const run = () => C.as(() => (scheduler as unknown as { runAllForTenant(n: string): Promise<void> }).runAllForTenant(C.tenant.name));
    await run();
    const types = async () =>
      (await base.notification.findMany({ where: { tenantId: C.tenant.id } })).map((n) => n.type).sort();
    const first = await types();
    expect(first).toEqual(
      expect.arrayContaining(['INVENTORY_EXPIRING', 'PATIENT_RETURN_DUE', 'PATIENT_REACTIVATION', 'EQUIPMENT_MAINTENANCE']),
    );
    await run();
    expect(await types()).toEqual(first);
  });

  it('inicia e encerra os temporizadores', () => {
    jest.useFakeTimers();
    try {
      const s = scheduler as unknown as { runAll(): Promise<void>; keepAlive(): Promise<void> };
      const runAll = jest.spyOn(s, 'runAll').mockResolvedValue();
      const keepAlive = jest.spyOn(s, 'keepAlive').mockResolvedValue();
      scheduler.onModuleInit();
      jest.advanceTimersByTime(60 * 60 * 1000);
      expect(runAll.mock.calls.length).toBeGreaterThanOrEqual(2);
      expect(keepAlive).toHaveBeenCalled();
      scheduler.onModuleDestroy();
      runAll.mockRestore();
      keepAlive.mockRestore();
    } finally {
      jest.useRealTimers();
    }
  });

  it('keep-alive consulta o banco só dentro do horário', async () => {
    const s = scheduler as unknown as { keepAlive(): Promise<void> };
    const spy = jest.spyOn(Date.prototype, 'getHours');
    spy.mockReturnValue(3);
    await s.keepAlive();
    spy.mockReturnValue(10);
    await s.keepAlive();
    spy.mockRestore();
  });
});
