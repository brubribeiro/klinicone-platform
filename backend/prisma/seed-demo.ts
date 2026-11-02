/**
 * Seed de DESENVOLVIMENTO: preenche as telas vazias com dados fictícios.
 * Uso: npm run prisma:seed:demo  (só local; nunca no deploy)
 *
 * 1) roda os seeds existentes na ordem certa (base, pacientes, pacotes, promoções, pacote+agenda);
 * 2) complementa o que ainda ficava vazio (equipamentos, financeiro, metas, pendências...).
 * Idempotente: cada registro tem chave natural ou marcador "seedDemo:" e só é criado se faltar.
 * Não cria arquivos (sem R2): documentos e fotos ficam só com metadados/texto.
 */
import 'dotenv/config';
import { execFileSync } from 'child_process';
import { Prisma } from '@prisma/client';
import { SKINCARE_DEMO_RULES } from './skincare-demo-data';
import { createScriptClient, runInScriptTenant } from './tenant-script';

const MARK = 'seedDemo:';

/** Recusa rodar em produção ou contra banco que não seja local. */
export function assertLocalEnvironment(env: NodeJS.ProcessEnv = process.env): void {
  if (env.NODE_ENV === 'production') {
    throw new Error('Seed demo recusado: NODE_ENV=production.');
  }
  for (const key of ['DATABASE_URL', 'DIRECT_URL'] as const) {
    const url = env[key];
    if (!url) {
      if (key === 'DATABASE_URL') throw new Error('Seed demo recusado: DATABASE_URL não definida.');
      continue;
    }
    let host: string;
    try {
      host = new URL(url).hostname;
    } catch {
      throw new Error(`Seed demo recusado: ${key} inválida.`);
    }
    if (!['localhost', '127.0.0.1', '[::1]', '::1'].includes(host)) {
      throw new Error(`Seed demo recusado: ${key} aponta para "${host}", não para localhost.`);
    }
  }
}

function runScript(script: string) {
  execFileSync('npx', ['ts-node', '--transpile-only', `prisma/${script}`], { stdio: 'inherit', env: process.env });
}

/** Seeds já existentes, em ordem (o principal roda duas vezes: agendamentos precisam de pacientes). */
function runBaseSeeds() {
  for (const s of [
    'seed.ts',
    'seed-patients.ts',
    'seed.ts',
    'seed-packages.ts',
    'seed-promotions.ts',
    'seed-package-appointments.ts',
  ]) {
    runScript(s);
  }
}

function at(daysOffset: number, hour = 9, minute = 0): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + daysOffset);
  d.setHours(hour, minute, 0, 0);
  return d;
}
const monthStart = (offset = 0) => new Date(new Date().getFullYear(), new Date().getMonth() + offset, 1);
const pick = <T>(arr: T[], i: number): T => arr[i % arr.length];

const prisma = createScriptClient();

async function seedExtras() {
  const admin = await prisma.user.findFirst({ where: { email: { startsWith: 'admin@' } } });
  const pros = await prisma.user.findMany({ where: { providesAppointments: true }, orderBy: { email: 'asc' } });
  const patients = await prisma.patient.findMany({ orderBy: { createdAt: 'asc' }, take: 40 });
  const procedures = await prisma.procedure.findMany({ orderBy: { name: 'asc' } });
  if (!admin || pros.length === 0 || patients.length < 10 || procedures.length === 0) {
    throw new Error('Base incompleta (usuários, pacientes ou procedimentos). Os seeds anteriores falharam?');
  }
  const procByName = (n: string) => procedures.find((p) => p.name === n) ?? procedures[0];

  // ── Agenda de trabalho e bloqueios ──────────────────────────────────────────
  console.log('\n→ Horários de atendimento e bloqueios...');
  for (const u of pros) {
    for (let dow = 1; dow <= 6; dow++) {
      const exists = await prisma.workingHours.findFirst({ where: { userId: u.id, dayOfWeek: dow } });
      if (!exists) {
        await prisma.workingHours.create({
          data: { userId: u.id, dayOfWeek: dow, startTime: '08:00', endTime: dow === 6 ? '13:00' : '18:00' },
        });
      }
    }
  }
  const blocks = [
    { reason: `${MARK}Congresso de estética`, startAt: at(12, 8), endAt: at(13, 18) },
    { reason: `${MARK}Consulta médica`, startAt: at(3, 14), endAt: at(3, 16) },
  ];
  for (const b of blocks) {
    if (!(await prisma.unavailability.findFirst({ where: { reason: b.reason } }))) {
      await prisma.unavailability.create({ data: { userId: pros[0].id, ...b } });
    }
  }

  // ── Medidas e dados clínicos na ficha (anamnese) ────────────────────────────
  console.log('→ Medidas corporais na anamnese...');
  let measured = 0;
  // Dados antigos trazem altura em metros (1,67); a ficha espera centímetros
  for (const p of await prisma.patient.findMany()) {
    const an = (p.anamnesis ?? {}) as Record<string, unknown>;
    const h = Number(String(an.altura ?? '').replace(',', '.'));
    if (h > 0 && h < 3) {
      await prisma.patient.update({ where: { id: p.id }, data: { anamnesis: { ...an, altura: Math.round(h * 100) } as Prisma.InputJsonValue } });
    }
  }
  for (const [i, p] of patients.slice(0, 25).entries()) {
    const an = (p.anamnesis ?? {}) as Record<string, unknown>;
    if (an.peso != null) continue;
    await prisma.patient.update({
      where: { id: p.id },
      data: {
        anamnesis: {
          ...an,
          peso: 52 + ((i * 7) % 38),
          altura: 154 + ((i * 5) % 28),
          queixaPrincipal: pick(['Manchas no rosto', 'Retenção de líquido', 'Flacidez leve', 'Acne e oleosidade', 'Rugas de expressão'], i),
          expectativas: 'Melhorar a aparência da pele e se sentir mais confiante.',
        } as Prisma.InputJsonValue,
      },
    });
    measured++;
  }
  console.log(`  ✓ ${measured} ficha(s) com peso/altura`);

  // ── Equipamentos ────────────────────────────────────────────────────────────
  console.log('→ Equipamentos...');
  const equipmentSeeds = [
    { name: 'Laser de diodo 808nm', brand: 'Aurora Med', model: 'LD-808', serialNumber: 'LD808-2201', purchaseValue: 38500, maintenanceValue: 1200, months: 6, notify: 15, last: -150, next: 30, proc: 'Peeling químico', cost: 18 },
    { name: 'Ultrassom microfocado', brand: 'Sonus', model: 'UF-3', serialNumber: 'UF3-9915', purchaseValue: 24900, maintenanceValue: 900, months: 12, notify: 30, last: -330, next: 20, proc: 'Microagulhamento', cost: 14 },
    { name: 'Caneta de microagulhamento', brand: 'DermaPen', model: 'DP-4', serialNumber: 'DP4-7731', purchaseValue: 3200, maintenanceValue: 250, months: 12, notify: 20, last: -400, next: -35, proc: 'Microagulhamento', cost: 6 },
    { name: 'Aparelho de drenagem (pressoterapia)', brand: 'Linfa Plus', model: 'LP-12', serialNumber: 'LP12-0458', purchaseValue: 7800, maintenanceValue: 400, months: 6, notify: 10, last: -90, next: 90, proc: 'Drenagem linfática', cost: 5 },
    { name: 'Autoclave 21L', brand: 'Esterilmed', model: 'EM-21', serialNumber: 'EM21-3320', purchaseValue: 5400, maintenanceValue: 350, months: 12, notify: 30, last: -200, next: 160, proc: null, cost: 0 },
    { name: 'Vaporizador facial (antigo)', brand: 'Clean Skin', model: 'VF-1', serialNumber: null, purchaseValue: 900, maintenanceValue: null, months: null, notify: null, last: null, next: null, proc: 'Limpeza de pele', cost: 2, inactive: true },
  ];
  for (const e of equipmentSeeds) {
    let eq = await prisma.equipment.findFirst({ where: { name: e.name } });
    if (!eq) {
      eq = await prisma.equipment.create({
        data: {
          name: e.name,
          brand: e.brand,
          model: e.model,
          serialNumber: e.serialNumber,
          purchaseDate: at(-540),
          purchaseValue: e.purchaseValue,
          maintenanceValue: e.maintenanceValue,
          maintenanceIntervalMonths: e.months,
          maintenanceNotifyDaysBefore: e.notify,
          lastMaintenanceAt: e.last != null ? at(e.last) : null,
          nextMaintenanceAt: e.next != null ? at(e.next) : null,
          scheduledMaintenanceAt: e.next != null && e.next > 0 && e.next < 40 ? at(e.next, 10) : null,
          notes: 'Equipamento de demonstração.',
          active: !('inactive' in e && e.inactive),
        },
      });
      await prisma.financialEntry.create({
        data: {
          type: 'EXPENSE',
          description: `Compra - ${e.name}`,
          amount: e.purchaseValue,
          category: 'Equipamentos',
          expenseType: 'FIXED',
          paidAt: at(-540),
          equipmentId: eq.id,
        },
      });
    }
    if (e.proc) {
      const procedure = procByName(e.proc);
      if (!(await prisma.procedureEquipment.findFirst({ where: { procedureId: procedure.id, equipmentId: eq.id } }))) {
        await prisma.procedureEquipment.create({ data: { procedureId: procedure.id, equipmentId: eq.id, costPerUse: e.cost } });
      }
    }
  }

  // ── Estoque: alertas e movimentações ────────────────────────────────────────
  console.log('→ Estoque (alertas e movimentações)...');
  const stock = async (sku: string) => prisma.inventoryItem.findFirst({ where: { sku } });
  if (!(await prisma.inventoryMovement.findFirst({ where: { reason: { startsWith: MARK } } }))) {
    // Estoque baixo, perto de vencer e vencido (alimentam pendências e notificações)
    await prisma.inventoryItem.updateMany({ where: { sku: 'MAT-011' }, data: { quantity: 3 } });
    await prisma.inventoryItem.updateMany({ where: { sku: 'MAT-014' }, data: { expiresAt: at(18), expiryNotifyDaysBefore: 30 } });
    await prisma.inventoryItem.updateMany({ where: { sku: 'MAT-009' }, data: { expiresAt: at(-6), expiryNotifyDaysBefore: 30 } });
    await prisma.inventoryItem.updateMany({ where: { sku: 'MAT-013' }, data: { quantity: 8 } });
    const moves: [string, 'IN' | 'OUT' | 'ADJUSTMENT', number, string, number, Date | null][] = [
      ['MAT-001', 'IN', 30, 'Compra mensal', -40, at(300)],
      ['MAT-001', 'OUT', 6, 'Uso em atendimentos', -20, null],
      ['MAT-004', 'IN', 100, 'Compra de luvas', -35, at(500)],
      ['MAT-004', 'OUT', 40, 'Uso em atendimentos', -12, null],
      ['MAT-009', 'IN', 250, 'Reposição de ácido', -90, at(-6)],
      ['MAT-011', 'OUT', 17, 'Amostras entregues', -8, null],
      ['MAT-013', 'IN', 40, 'Compra de cartuchos', -60, at(400)],
      ['MAT-013', 'OUT', 32, 'Uso em microagulhamento', -10, null],
      ['MAT-014', 'IN', 100, 'Compra de sérum', -45, at(18)],
      ['MAT-012', 'ADJUSTMENT', -50, 'Ajuste de inventário', -5, null],
    ];
    for (const [sku, type, quantity, reason, days, expiresAt] of moves) {
      const item = await stock(sku);
      if (!item) continue;
      await prisma.inventoryMovement.create({
        data: { itemId: item.id, type, quantity, reason: `${MARK}${reason}`, expiresAt, createdAt: at(days, 11) },
      });
    }
  }

  // ── Despesas recorrentes e lançamentos financeiros ──────────────────────────
  console.log('→ Despesas recorrentes e financeiro...');
  const extraRecurring = [
    { name: 'Aluguel da sala', description: 'Sala comercial.', amount: 2800, category: 'Aluguel', expenseType: 'FIXED' as const, dueDay: 5 },
    { name: 'Seguro do consultório', description: 'Parcela mensal.', amount: 210, category: 'Seguros', expenseType: 'FIXED' as const, dueDay: 12 },
  ];
  for (const r of extraRecurring) {
    if (!(await prisma.recurringExpense.findFirst({ where: { name: r.name } }))) {
      await prisma.recurringExpense.create({ data: { ...r, active: true } });
    }
  }
  const recurring = await prisma.recurringExpense.findMany({ where: { active: true } });
  const today = new Date();
  for (let back = 3; back >= 0; back--) {
    const ms = monthStart(-back);
    const me = new Date(ms.getFullYear(), ms.getMonth() + 1, 0, 23, 59, 59, 999);
    for (const re of recurring) {
      if (await prisma.financialEntry.findFirst({ where: { recurringExpenseId: re.id, dueDate: { gte: ms, lte: me } } })) continue;
      const dueDate = new Date(ms.getFullYear(), ms.getMonth(), Math.min(re.dueDay, 28), 12);
      const paid = dueDate < today && !(back === 1 && re.dueDay % 3 === 0); // um atrasado no mês passado
      await prisma.financialEntry.create({
        data: {
          type: 'EXPENSE',
          description: re.name,
          amount: re.amount,
          category: re.category,
          expenseType: re.expenseType,
          dueDate,
          paidAt: paid ? dueDate : null,
          recurringExpenseId: re.id,
        },
      });
    }
  }
  const sundries = [
    { description: 'Curso de atualização — peelings', amount: 890, category: 'Educação', days: -25 },
    { description: 'Manutenção do ar-condicionado', amount: 320, category: 'Manutenção', days: -14 },
    { description: 'Material de papelaria', amount: 86.5, category: 'Escritório', days: -9 },
  ];
  for (const s of sundries) {
    if (!(await prisma.financialEntry.findFirst({ where: { description: s.description } }))) {
      await prisma.financialEntry.create({
        data: { type: 'EXPENSE', description: s.description, amount: s.amount, category: s.category, expenseType: 'VARIABLE', paidAt: at(s.days), dueDate: at(s.days) },
      });
    }
  }

  // Receita dos atendimentos concluídos (mesma regra do backfill da API, com forma de pagamento)
  const methods = await prisma.paymentMethod.findMany({ where: { active: true }, orderBy: { name: 'asc' } });
  const completed = await prisma.appointment.findMany({
    where: { status: 'COMPLETED', financeGenerated: false, procedureId: { not: null }, patientPackageId: null },
    include: { patient: true, procedure: true },
    orderBy: { startAt: 'asc' },
  });
  let incomes = 0;
  for (const [i, a] of completed.entries()) {
    if (!a.procedure || (await prisma.financialEntry.findFirst({ where: { appointmentId: a.id } }))) continue;
    const pm = methods.length ? pick(methods, i) : null;
    const amount = Number(a.procedure.price);
    const fee = pm ? Number(pm.feePercent) : null;
    await prisma.financialEntry.create({
      data: {
        type: 'INCOME',
        description: `${a.procedure.name} - ${a.patient.name}`,
        amount,
        feePercent: fee,
        netAmount: fee != null ? Math.round(amount * (1 - fee / 100) * 100) / 100 : null,
        paymentMethodId: pm?.id,
        category: 'Atendimentos',
        paidAt: a.startAt,
        patientId: a.patientId,
        appointmentId: a.id,
        invoiceIssued: i % 3 === 0,
        invoiceIssuedAt: i % 3 === 0 ? a.startAt : null,
      },
    });
    await prisma.appointment.update({ where: { id: a.id }, data: { financeGenerated: true } });
    incomes++;
  }
  console.log(`  ✓ ${incomes} receita(s) de atendimentos concluídos`);
  // Receitas avulsas no mês atual (painel e financeiro abrem no mês corrente)
  const extras = [
    { description: 'Venda de kit skincare', amount: 289.9, category: 'Produtos' },
    { description: 'Venda de protetor solar', amount: 98, category: 'Produtos' },
    { description: 'Sinal de reserva — noiva', amount: 500, category: 'Pacotes' },
  ];
  for (const [i, x] of extras.entries()) {
    if (await prisma.financialEntry.findFirst({ where: { description: x.description, type: 'INCOME' } })) continue;
    await prisma.financialEntry.create({
      data: { type: 'INCOME', ...x, paymentMethodId: pick(methods, i + 1)?.id, paidAt: at(0, 10 + i), patientId: patients[i].id },
    });
  }

  // ── Pacotes vendidos (todos os status) com sessões ──────────────────────────
  console.log('→ Pacotes vendidos e sessões...');
  const packages = await prisma.package.findMany({ where: { active: true }, include: { items: true }, orderBy: { name: 'asc' } });
  const sessionPkgs = packages.filter((p) => p.type === 'SESSIONS' && p.items.length > 0 && p.totalPrice != null);
  const sales = [
    { n: 1, status: 'ACTIVE', used: 2, bought: -40, expires: 140 },
    { n: 2, status: 'ACTIVE', used: 1, bought: -15, expires: 165 },
    { n: 3, status: 'ACTIVE', used: 0, bought: -3, expires: 177 },
    { n: 4, status: 'COMPLETED', used: -1, bought: -120, expires: 60 },
    { n: 5, status: 'EXPIRED', used: 1, bought: -260, expires: -80 },
    { n: 6, status: 'CANCELLED', used: 0, bought: -70, expires: 110 },
  ] as const;
  for (const [i, s] of sales.entries()) {
    const marker = `${MARK}pacote-vendido-${s.n}`;
    if (sessionPkgs.length === 0 || (await prisma.patientPackage.findFirst({ where: { notes: marker } }))) continue;
    const pkg = pick(sessionPkgs, i);
    const patient = patients[10 + i];
    const total = pkg.sessionCount;
    const used = s.used === -1 ? total : Math.min(s.used, total);
    const pm = pick(methods, i + 1);
    const pp = await prisma.patientPackage.create({
      data: {
        patientId: patient.id,
        packageId: pkg.id,
        status: s.status,
        totalPaid: pkg.totalPrice!,
        paymentMethod: pm?.name,
        purchaseDate: at(s.bought),
        expiresAt: at(s.expires),
        sessionsTotal: total,
        sessionsUsed: used,
        notes: marker,
        financeGenerated: s.status !== 'CANCELLED',
      },
    });
    if (s.status !== 'CANCELLED') {
      await prisma.financialEntry.create({
        data: {
          type: 'INCOME',
          description: `Pacote - ${pkg.name} - ${patient.name}`,
          amount: pkg.totalPrice!,
          category: 'Pacotes',
          paymentMethodId: pm?.id,
          paidAt: at(s.bought),
          patientId: patient.id,
        },
      });
    }
    const item = pkg.items[0];
    for (let k = 0; k < used; k++) {
      const start = at(s.bought + 7 * (k + 1), 9 + (k % 4));
      const proc = procedures.find((p) => p.id === item.procedureId) ?? procedures[0];
      await prisma.appointment.create({
        data: {
          patientId: patient.id,
          procedureId: proc.id,
          appointmentProcedures: { create: { procedureId: proc.id } },
          professionalId: pick(pros, i + k).id,
          startAt: start,
          endAt: new Date(start.getTime() + proc.durationMinutes * 60000),
          status: 'COMPLETED',
          startedAt: start,
          finishedAt: new Date(start.getTime() + proc.durationMinutes * 60000),
          patientPackageId: pp.id,
          financeGenerated: true,
          notes: `${marker}:sessao-${k + 1}`,
          clinicalNotes: `Sessão ${k + 1} de ${total} do pacote. Boa tolerância, sem intercorrências.`,
        },
      });
    }
    // sessão futura agendada para os pacotes em andamento
    if (s.status === 'ACTIVE' && used < total) {
      const proc = procedures.find((p) => p.id === item.procedureId) ?? procedures[0];
      const start = at(4 + i, 15);
      await prisma.appointment.create({
        data: {
          patientId: patient.id,
          procedureId: proc.id,
          appointmentProcedures: { create: { procedureId: proc.id } },
          professionalId: pros[0].id,
          startAt: start,
          endAt: new Date(start.getTime() + proc.durationMinutes * 60000),
          status: 'SCHEDULED',
          patientPackageId: pp.id,
          notes: `${marker}:proxima`,
        },
      });
    }
  }

  // ── Agenda: status e tipos que faltavam ─────────────────────────────────────
  console.log('→ Agendamentos (todos os status e tipos)...');
  const promo = await prisma.promotion.findFirst({ where: { active: true }, orderBy: { startAt: 'desc' } });
  const apptSeeds = [
    { k: 'em-andamento', st: 'IN_PROGRESS', kind: 'PROCEDURE', day: 0, h: new Date().getHours() > 8 ? new Date().getHours() - 1 : 8, proc: 'Limpeza de pele' },
    { k: 'faltou-1', st: 'NO_SHOW', kind: 'PROCEDURE', day: -3, h: 10, proc: 'Peeling químico' },
    { k: 'faltou-2', st: 'NO_SHOW', kind: 'RETURN', day: -9, h: 15, proc: 'Microagulhamento' },
    { k: 'avaliacao-1', st: 'COMPLETED', kind: 'EVALUATION', day: -6, h: 11, proc: 'Limpeza de pele' },
    { k: 'avaliacao-2', st: 'SCHEDULED', kind: 'EVALUATION', day: 2, h: 14, proc: 'Peeling químico' },
    { k: 'retorno-1', st: 'COMPLETED', kind: 'RETURN', day: -11, h: 16, proc: 'Drenagem linfática' },
    { k: 'retorno-2', st: 'CONFIRMED', kind: 'RETURN', day: 1, h: 9, proc: 'Microagulhamento' },
    { k: 'promo-1', st: 'COMPLETED', kind: 'PROCEDURE', day: -5, h: 9, proc: 'Limpeza de pele', promo: true },
    { k: 'cancelado-1', st: 'CANCELLED', kind: 'PROCEDURE', day: 5, h: 10, proc: 'Drenagem linfática' },
  ] as const;
  for (const [i, a] of apptSeeds.entries()) {
    const marker = `${MARK}status-${a.k}`;
    if (await prisma.appointment.findFirst({ where: { notes: marker } })) continue;
    const proc = procByName(a.proc);
    const start = at(a.day, a.h, (i % 3) * 15);
    const end = new Date(start.getTime() + proc.durationMinutes * 60000);
    const done = a.st === 'COMPLETED';
    const appt = await prisma.appointment.create({
      data: {
        patientId: patients[20 + i].id,
        procedureId: proc.id,
        appointmentProcedures: { create: { procedureId: proc.id } },
        professionalId: pick(pros, i).id,
        startAt: start,
        endAt: end,
        status: a.st,
        kind: a.kind,
        notes: marker,
        clinicalNotes: done ? 'Atendimento sem intercorrências. Orientada quanto aos cuidados pós.' : null,
        startedAt: done || a.st === 'IN_PROGRESS' ? start : null,
        finishedAt: done ? end : null,
        promotionId: 'promo' in a && promo ? promo.id : null,
      },
    });
    if (done) {
      const pm = pick(methods, i);
      const discount = 'promo' in a && promo ? 0.9 : 1;
      await prisma.financialEntry.create({
        data: {
          type: 'INCOME',
          description: `${proc.name} - ${patients[20 + i].name}${discount < 1 && promo ? ` (Promoção: ${promo.name})` : ''}`,
          amount: Math.round(Number(proc.price) * discount * 100) / 100,
          paymentMethodId: pm?.id,
          category: 'Atendimentos',
          paidAt: start,
          patientId: appt.patientId,
          appointmentId: appt.id,
        },
      });
      await prisma.appointment.update({ where: { id: appt.id }, data: { financeGenerated: true } });
      const extra = await stock('MAT-005');
      if (extra && i % 2 === 0) {
        await prisma.appointmentMaterial.create({ data: { appointmentId: appt.id, itemId: extra.id, quantity: 2 } });
      }
    }
  }

  // ── Metas ───────────────────────────────────────────────────────────────────
  console.log('→ Metas...');
  const goals = [
    { name: 'Faturamento do mês', metric: 'REVENUE', format: 'CURRENCY', target: 18000, periodType: 'MONTH', start: monthStart(), color: '#15998B' },
    { name: 'Novos pacientes', metric: 'NEW_PATIENTS', format: 'NUMBER', target: 15, periodType: 'MONTH', start: monthStart(), color: '#7C5CBF' },
    { name: 'Procedimentos realizados', metric: 'PROCEDURES', format: 'NUMBER', target: 80, periodType: 'MONTH', start: monthStart(), color: '#E08A3C' },
    { name: 'Ticket médio', metric: 'AVERAGE_TICKET', format: 'CURRENCY', target: 220, periodType: 'MONTH', start: monthStart(), color: '#D9577A' },
    { name: 'Avaliações no Google', metric: 'MANUAL', format: 'NUMBER', target: 30, manualValue: 18, periodType: 'MONTH', start: monthStart(), color: '#3B82C4' },
    { name: 'Taxa de ocupação', metric: 'OCCUPANCY', format: 'PERCENT', target: 75, periodType: 'QUARTER', start: new Date(new Date().getFullYear(), Math.floor(new Date().getMonth() / 3) * 3, 1), color: '#15998B' },
    { name: 'Faturamento do ano', metric: 'REVENUE', format: 'CURRENCY', target: 220000, periodType: 'YEAR', start: new Date(new Date().getFullYear(), 0, 1), color: '#7C5CBF' },
    { name: 'Taxa de retorno', metric: 'RETURN_RATE', format: 'PERCENT', target: 60, periodType: 'QUARTER', start: new Date(new Date().getFullYear(), Math.floor(new Date().getMonth() / 3) * 3, 1), color: '#E08A3C' },
  ] as const;
  for (const g of goals) {
    const { start, ...rest } = g;
    if (!(await prisma.goal.findFirst({ where: { name: g.name, periodType: g.periodType } }))) {
      await prisma.goal.create({ data: { ...rest, periodStart: start } });
    }
  }

  // ── Documentos (só metadados e texto) ───────────────────────────────────────
  console.log('→ Documentos...');
  const templates = await prisma.documentTemplate.findMany({ orderBy: { name: 'asc' } });
  const docs = [
    { name: 'Termo de consentimento — Olivia', category: 'consentimento', status: 'SIGNED', p: 0, days: -30 },
    { name: 'Ficha de anamnese — Marina', category: 'anamnese', status: 'SIGNED', p: 1, days: -22 },
    { name: 'Autorização de uso de imagem', category: 'autorizacao_imagem', status: 'SENT', p: 2, days: -4 },
    { name: 'Termo de consentimento — peeling', category: 'consentimento', status: 'PENDING', p: 3, days: -2 },
    { name: 'Contrato de pacote de sessões', category: 'contrato', status: 'PENDING', p: 4, days: -1 },
    { name: 'Termo de consentimento — microagulhamento', category: 'consentimento', status: 'SIGNED', p: 5, days: -15 },
  ] as const;
  for (const d of docs) {
    const patient = patients[d.p];
    const name = `${d.name} (${patient.name.split(' ')[0]})`;
    if (await prisma.document.findFirst({ where: { name } })) continue;
    const tpl = templates.find((t) => t.category === d.category) ?? templates[0];
    await prisma.document.create({
      data: {
        name,
        category: d.category,
        status: d.status,
        signedAt: d.status === 'SIGNED' ? at(d.days) : null,
        content: tpl?.content.replace(/{{paciente}}/g, patient.name).replace(/{{cpf}}/g, patient.document ?? '—'),
        templateId: tpl?.id,
        patientId: patient.id,
        createdAt: at(d.days),
      },
    });
  }
  const laser = await prisma.equipment.findFirst({ where: { name: 'Laser de diodo 808nm' } });
  const eqDoc = 'Manual e certificado de calibração — Laser de diodo';
  if (laser && !(await prisma.document.findFirst({ where: { name: eqDoc } }))) {
    await prisma.document.create({
      data: { name: eqDoc, category: 'certificado', status: 'SIGNED', signedAt: at(-150), equipmentId: laser.id },
    });
  }

  // ── Rotinas de skincare ─────────────────────────────────────────────────────
  console.log('→ Rotinas de skincare...');
  const products = await prisma.skincareProduct.findMany({ orderBy: { createdAt: 'asc' } });
  const ruleOf = (field: string, value: string) => SKINCARE_DEMO_RULES.find((r) => r.field === field && r.value === value);
  const routineSeeds = [
    { p: 6, pele: 'oleosa', afec: ['acne'], olheira: 'nenhuma', idade: '25-34', days: -20 },
    { p: 7, pele: 'seca', afec: ['melasma'], olheira: 'pigmentares', idade: '35-44', days: -9 },
    { p: 8, pele: 'sensivel', afec: ['rosacea'], olheira: 'vasculares', idade: '45+', days: -2 },
    { p: 9, pele: 'mista', afec: [], olheira: 'nenhuma', idade: '18-24', days: -45 },
  ];
  for (const r of routineSeeds) {
    const patient = patients[r.p];
    const notes = `${MARK}rotina-${r.pele}`;
    if (products.length === 0 || (await prisma.skincareRoutine.findFirst({ where: { patientId: patient.id, notes } }))) continue;
    const rule = ruleOf('pele', r.pele);
    const chosen = (rule?.productKeys ?? []).map((k) => products[Number(k.slice(1)) - 1]).filter(Boolean);
    const items = chosen.map((prod) => ({
      moment: prod.moments[0] ?? 'manha',
      step: prod.step,
      productId: prod.id,
      name: prod.name,
      brand: prod.brand,
      activeIngredient: prod.activeIngredient,
      howTo: prod.howTo,
      note: prod.note,
    }));
    await prisma.skincareRoutine.create({
      data: {
        patientId: patient.id,
        consultDate: at(r.days),
        answers: { pele: r.pele, afec: r.afec, afecOutra: '', olheira: r.olheira, olheiraTipo: '', idade: r.idade },
        items,
        avoided: [],
        guidelines: rule?.note ? [{ text: rule.note, source: `pele:${r.pele}` }] : [],
        notes,
        createdById: admin.id,
        createdByName: admin.name,
        createdAt: at(r.days),
      },
    });
  }

  // ── Pendências, notificações, feedback, auditoria ───────────────────────────
  console.log('→ Pendências, notificações, feedback e histórico...');
  const pendings = [
    { k: 1, title: 'Renovar alvará da vigilância sanitária', category: 'HEALTH_SURVEILLANCE', due: 15, urgent: true },
    { k: 2, title: 'Responder avaliações do Google', category: 'MARKETING', due: 3, urgent: false },
    { k: 3, title: 'Conferir comissão da equipe', category: 'FINANCE', due: -2, urgent: true },
    { k: 4, title: 'Reunião de alinhamento mensal', category: 'TEAM', due: 7, urgent: false },
    { k: 5, title: 'Organizar sala de esterilização', category: 'OPERATIONAL', due: 10, urgent: false },
    { k: 6, title: 'Planejar campanha de Black Friday', category: 'MARKETING', due: 20, urgent: false },
    { k: 7, title: 'Enviar contrato do contador', category: 'ADMINISTRATIVE', due: -10, urgent: false, resolved: true },
  ] as const;
  for (const t of pendings) {
    const sourceKey = `${MARK}pendencia-${t.k}`;
    if (await prisma.pendingTask.findFirst({ where: { sourceKey } })) continue;
    await prisma.pendingTask.create({
      data: {
        sourceKey,
        title: t.title,
        category: t.category,
        dueDate: at(t.due),
        urgent: t.urgent,
        assigneeId: pick(pros, t.k).id,
        createdById: admin.id,
        resolvedAt: 'resolved' in t ? at(-8) : null,
        resolvedById: 'resolved' in t ? admin.id : null,
        resolvedByName: 'resolved' in t ? admin.name : null,
      },
    });
  }

  const notifs = [
    { type: 'APPOINTMENT_CREATED', title: 'Novo agendamento', message: `${patients[0].name} agendou para amanhã às 09:00.`, link: '/agenda', read: false, d: 0 },
    { type: 'APPOINTMENT_CANCELLED', title: 'Agendamento cancelado', message: `${patients[1].name} cancelou o horário de sexta.`, link: '/agenda', read: false, d: -1 },
    { type: 'INVENTORY_LOW_STOCK', title: 'Estoque baixo', message: 'Protetor solar FPS 50 está abaixo do mínimo (3 un).', link: '/estoque', read: false, d: -1 },
    { type: 'INVENTORY_EXPIRING', title: 'Material vencendo', message: 'Sérum vitamina C vence em 18 dias.', link: '/estoque', read: true, d: -2 },
    { type: 'EQUIPMENT_MAINTENANCE', title: 'Manutenção de equipamento', message: 'Caneta de microagulhamento está com manutenção atrasada.', link: '/equipamentos', read: false, d: -3 },
    { type: 'PATIENT_CREATED', title: 'Novo paciente', message: `${patients[2].name} foi cadastrada.`, link: '/pacientes', read: true, d: -4 },
    { type: 'PATIENT_RETURN_DUE', title: 'Retorno pendente', message: `${patients[3].name} está há 90 dias sem voltar.`, link: '/pacientes', read: true, d: -6 },
    { type: 'PATIENT_REACTIVATION', title: 'Reativação de paciente', message: `${patients[4].name} voltou a agendar.`, link: '/pacientes', read: true, d: -8 },
  ] as const;
  for (const u of [admin, pros[0]]) {
    for (const n of notifs) {
      if (await prisma.notification.findFirst({ where: { userId: u.id, title: n.title, message: n.message } })) continue;
      await prisma.notification.create({
        data: {
          userId: u.id,
          type: n.type,
          title: n.title,
          message: n.message,
          link: n.link,
          read: n.read,
          readAt: n.read ? at(n.d, 18) : null,
          metadata: { seedDemo: true },
          createdAt: at(n.d, 8),
        },
      });
    }
  }

  const feedbacks = [
    { type: 'BUG', title: 'Calendário não rola no celular', description: 'Na visão semanal a agenda fica cortada no iPhone.', pageUrl: '/agenda' },
    { type: 'SUGGESTION', title: 'Exportar financeiro em planilha', description: 'Seria útil baixar o extrato do mês em CSV.', pageUrl: '/financeiro' },
    { type: 'SUGGESTION', title: 'Lembrete automático por WhatsApp', description: 'Enviar o lembrete 24h antes direto do sistema.', pageUrl: '/mensagens' },
  ] as const;
  for (const f of feedbacks) {
    if (!(await prisma.feedbackReport.findFirst({ where: { title: f.title } }))) {
      await prisma.feedbackReport.create({ data: { ...f, userId: pick(pros, 1).id } });
    }
  }

  if (!(await prisma.auditLog.findFirst({ where: { entityId: { startsWith: MARK } } }))) {
    const entries = [
      { entity: 'Patient', action: 'CREATE', changes: { name: { new: patients[0].name } } },
      { entity: 'Procedure', action: 'UPDATE', changes: { price: { old: 120, new: 135 } } },
      { entity: 'InventoryItem', action: 'UPDATE', changes: { quantity: { old: 20, new: 3 } } },
      { entity: 'Appointment', action: 'DELETE', changes: { status: { old: 'SCHEDULED' } } },
    ] as const;
    for (const [i, e] of entries.entries()) {
      await prisma.auditLog.create({
        data: { entity: e.entity, entityId: `${MARK}${i + 1}`, action: e.action, changes: e.changes, userId: admin.id, userName: admin.name, createdAt: at(-i - 1, 15) },
      });
    }
  }

  const count = async () => ({
    pacientes: await prisma.patient.count(),
    agendamentos: await prisma.appointment.count(),
    procedimentos: await prisma.procedure.count(),
    pacotes: await prisma.package.count(),
    pacotesVendidos: await prisma.patientPackage.count(),
    promocoes: await prisma.promotion.count(),
    estoque: await prisma.inventoryItem.count(),
    movimentacoes: await prisma.inventoryMovement.count(),
    equipamentos: await prisma.equipment.count(),
    despesasRecorrentes: await prisma.recurringExpense.count(),
    lancamentos: await prisma.financialEntry.count(),
    formasPagamento: await prisma.paymentMethod.count(),
    metas: await prisma.goal.count(),
    documentos: await prisma.document.count(),
    modelosMensagem: await prisma.messageTemplate.count(),
    pendencias: await prisma.pendingTask.count(),
    notificacoes: await prisma.notification.count(),
    rotinasSkincare: await prisma.skincareRoutine.count(),
    feedbacks: await prisma.feedbackReport.count(),
    auditoria: await prisma.auditLog.count(),
  });
  console.log('\nContagens:', await count());
}

async function main() {
  assertLocalEnvironment();
  console.log('Seed demo (apenas ambiente local).');
  runBaseSeeds();
  await runInScriptTenant(prisma, async () => seedExtras());
  console.log('\nSeed demo concluído.\n');
}

if (require.main === module) {
  main()
    .catch((e) => {
      console.error(e instanceof Error ? e.message : e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
