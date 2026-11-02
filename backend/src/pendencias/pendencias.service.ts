import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DocumentStatus, PendingCategory, PendingRule, PendingTask, Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { TenantContext } from '../tenancy/tenant-context';
import { AppointmentsService } from '../appointments/appointments.service';
import { FinanceService } from '../finance/finance.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { upcomingCommemorativeDates } from '../common/utils/commemorative-dates.util';
import {
  AssignPendingDto,
  CreatePendingTaskDto,
  UpdatePendingRulesDto,
  UpdatePendingTaskDto,
} from './dto/pending-task.dto';

export type PendingGroup = 'URGENT' | 'OVERDUE' | 'UPCOMING';

export interface PendingItem {
  /** Manual: "MANUAL:<id>"; gerada por regra: a sourceKey da ocorrência. */
  key: string;
  taskId: string | null;
  rule: PendingRule | null;
  category: PendingCategory;
  group: PendingGroup;
  title: string;
  subtitle: string | null;
  description: string | null;
  deadlineLabel: string;
  /** YYYY-MM-DD */
  dueDate: string | null;
  urgent: boolean;
  link: string | null;
  assignee: { id: string; name: string } | null;
}

export interface PendingRuleConfig {
  rule: PendingRule;
  enabled: boolean;
  /** Margem (LOW_STOCK) ou antecedência em dias; null nas regras sem parâmetro. */
  param: number | null;
  assigneeId: string | null;
}

interface RuleDef {
  category: PendingCategory;
  enabled: boolean;
  param: number | null;
  /** Permissão da tela de origem; quem não vê a origem não vê as pendências dela. */
  permission: string;
}

const RULE_DEFS: Record<PendingRule, RuleDef> = {
  LOW_STOCK: { category: 'INVENTORY', enabled: true, param: 0, permission: 'inventory:view' },
  EXPIRING_STOCK: { category: 'INVENTORY', enabled: true, param: 90, permission: 'inventory:view' },
  BILLS_DUE: { category: 'FINANCE', enabled: true, param: 7, permission: 'finance:view' },
  APPOINTMENT_NO_OUTCOME: { category: 'OPERATIONAL', enabled: true, param: null, permission: 'appointments:view' },
  EQUIPMENT_MAINTENANCE: { category: 'MAINTENANCE', enabled: true, param: 30, permission: 'equipment:view' },
  DOCUMENT_UNSIGNED: { category: 'ADMINISTRATIVE', enabled: true, param: null, permission: 'documents:view' },
  COMMEMORATIVE_DATE: { category: 'MARKETING', enabled: false, param: 60, permission: 'promotions:view' },
};

const RULES = Object.keys(RULE_DEFS) as PendingRule[];
const RULES_SETTING_KEY = 'pending_rules';
const MANUAL_PREFIX = 'MANUAL:';
/** Prazos a até 2 dias contam como urgentes. */
const URGENT_WITHIN_DAYS = 2;
const RESOLVED_WINDOW_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;
const BRAZIL_OFFSET_MS = 3 * 60 * 60 * 1000;

/** Hoje (YYYY-MM-DD) no fuso do Brasil (sem horário de verão desde 2019). */
function brazilToday() {
  return new Date(Date.now() - BRAZIL_OFFSET_MS).toISOString().slice(0, 10);
}

/** Datas sem horário (vencimento, validade, manutenção) são gravadas à meia-noite UTC. */
function dateKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

function addDays(day: string, n: number) {
  return dateKey(new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY_MS));
}

function daysBetween(from: string, to: string) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
}

function formatDay(day: string) {
  const [y, m, d] = day.split('-');
  return `${d}/${m}/${y}`;
}

function formatQty(value: Prisma.Decimal | number) {
  return Number(value).toLocaleString('pt-BR', { maximumFractionDigits: 3 });
}

function formatMoney(value: Prisma.Decimal | number) {
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** Grupo e texto do prazo de uma pendência com data. */
function byDueDate(today: string, due: string, verbs: { past: string; future: string }) {
  const days = daysBetween(today, due);
  const group: PendingGroup = days < 0 ? 'OVERDUE' : days <= URGENT_WITHIN_DAYS ? 'URGENT' : 'UPCOMING';
  const when = days === 0 ? 'hoje' : days === 1 ? 'amanhã' : `em ${formatDay(due)}`;
  const label =
    days < 0
      ? `${verbs.past} em ${formatDay(due)} · ${-days} dia(s) de atraso`
      : `${verbs.future} ${when}${days > 1 ? ` · ${days} dias` : ''}`;
  return { group, label };
}

const taskInclude = { assignee: { select: { id: true, name: true } } } as const;
type TaskWithAssignee = Prisma.PendingTaskGetPayload<{ include: typeof taskInclude }>;

@Injectable()
export class PendenciasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
    private readonly appointments: AppointmentsService,
    private readonly finance: FinanceService,
  ) {}

  // ---------------------------------------------------------------------------
  // Regras
  // ---------------------------------------------------------------------------

  async getRules(): Promise<PendingRuleConfig[]> {
    const row = await this.prisma.appSetting.findFirst({ where: { key: RULES_SETTING_KEY } });
    let stored: Partial<Record<PendingRule, Partial<PendingRuleConfig>>> = {};
    try {
      stored = row ? JSON.parse(row.value) : {};
    } catch {
      stored = {};
    }
    return RULES.map((rule) => {
      const def = RULE_DEFS[rule];
      const saved = stored[rule] ?? {};
      return {
        rule,
        enabled: typeof saved.enabled === 'boolean' ? saved.enabled : def.enabled,
        param: def.param === null ? null : typeof saved.param === 'number' ? saved.param : def.param,
        assigneeId: saved.assigneeId ?? null,
      };
    });
  }

  async updateRules(dto: UpdatePendingRulesDto, user: AuthenticatedUser) {
    const current = await this.getRules();
    const byRule = new Map(dto.rules.map((r) => [r.rule, r]));
    const assigneeIds = [...new Set(dto.rules.map((r) => r.assigneeId).filter((id): id is string => !!id))];
    if (assigneeIds.length) {
      const found = await this.prisma.user.count({ where: { id: { in: assigneeIds } } });
      if (found !== assigneeIds.length) throw new BadRequestException('Responsável inválido');
    }

    const next: PendingRuleConfig[] = current.map((c) => {
      const input = byRule.get(c.rule);
      if (!input) return c;
      return {
        rule: c.rule,
        enabled: input.enabled,
        param: RULE_DEFS[c.rule].param === null ? null : (input.param ?? RULE_DEFS[c.rule].param),
        assigneeId: input.assigneeId ?? null,
      };
    });

    const value = JSON.stringify(Object.fromEntries(next.map(({ rule, ...rest }) => [rule, rest])));
    await this.prisma.appSetting.upsert({
      where: { tenantId_key: { tenantId: TenantContext.requireTenantId(), key: RULES_SETTING_KEY } },
      create: { key: RULES_SETTING_KEY, value },
      update: { value },
    });
    // Achata para o diff da auditoria (objetos aninhados são ignorados por ele).
    const flat = (list: PendingRuleConfig[]) =>
      Object.fromEntries(
        list.flatMap((r) => [
          [`${r.rule}.enabled`, r.enabled],
          [`${r.rule}.param`, r.param],
          [`${r.rule}.assigneeId`, r.assigneeId],
        ]),
      );
    await this.audit.logUpdate('PendingRules', RULES_SETTING_KEY, flat(current), flat(next), user);
    return next;
  }

  // ---------------------------------------------------------------------------
  // Lista
  // ---------------------------------------------------------------------------

  async list(user: AuthenticatedUser) {
    const today = brazilToday();
    const [rules, tasks, resolvedCount] = await Promise.all([
      this.getRules(),
      this.prisma.pendingTask.findMany({
        where: { OR: [{ resolvedAt: null }, { sourceKey: { not: null } }] },
        include: taskInclude,
      }),
      this.prisma.pendingTask.count({
        where: { resolvedAt: { gte: new Date(Date.now() - RESOLVED_WINDOW_DAYS * DAY_MS) } },
      }),
    ]);

    const generated = await this.generate(rules, user, today);
    const stateByKey = new Map(tasks.filter((t) => t.sourceKey).map((t) => [t.sourceKey as string, t]));
    const users = await this.usersById(rules.map((r) => r.assigneeId));
    const ruleAssignee = new Map(rules.map((r) => [r.rule, r.assigneeId ? users.get(r.assigneeId) ?? null : null]));

    const items: PendingItem[] = [];
    for (const g of generated) {
      const state = stateByKey.get(g.key);
      if (state?.resolvedAt) continue;
      items.push({
        ...g,
        taskId: state?.id ?? null,
        assignee: state?.assignee ?? ruleAssignee.get(g.rule as PendingRule) ?? g.assignee ?? null,
      });
    }
    for (const t of tasks) {
      if (t.sourceKey || t.resolvedAt) continue;
      items.push(this.manualItem(t, today));
    }

    const order: Record<PendingGroup, number> = { OVERDUE: 0, URGENT: 1, UPCOMING: 2 };
    items.sort(
      (a, b) =>
        order[a.group] - order[b.group] ||
        (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999') ||
        a.title.localeCompare(b.title, 'pt-BR'),
    );

    return {
      items,
      resolvedCount,
      activeRules: rules.filter((r) => r.enabled).length,
      totalRules: rules.length,
    };
  }

  listResolved() {
    return this.prisma.pendingTask.findMany({
      where: { resolvedAt: { gte: new Date(Date.now() - RESOLVED_WINDOW_DAYS * DAY_MS) } },
      include: taskInclude,
      orderBy: { resolvedAt: 'desc' },
    });
  }

  // ---------------------------------------------------------------------------
  // Pendências manuais
  // ---------------------------------------------------------------------------

  async create(dto: CreatePendingTaskDto, user: AuthenticatedUser) {
    await this.assertUser(dto.assigneeId);
    const task = await this.prisma.pendingTask.create({
      data: {
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        category: dto.category,
        dueDate: dto.dueDate ? new Date(`${dto.dueDate}T00:00:00Z`) : null,
        urgent: dto.urgent ?? false,
        assigneeId: dto.assigneeId ?? null,
        createdById: user.id,
      },
      include: taskInclude,
    });
    await this.audit.logCreate('PendingTask', task.id, task as unknown as Record<string, unknown>, user);
    return task;
  }

  async update(id: string, dto: UpdatePendingTaskDto, user: AuthenticatedUser) {
    const before = await this.findManual(id);
    await this.assertUser(dto.assigneeId);
    const task = await this.prisma.pendingTask.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.description !== undefined ? { description: dto.description?.trim() || null } : {}),
        ...(dto.category !== undefined ? { category: dto.category } : {}),
        ...(dto.dueDate !== undefined
          ? { dueDate: dto.dueDate ? new Date(`${dto.dueDate}T00:00:00Z`) : null }
          : {}),
        ...(dto.urgent !== undefined ? { urgent: dto.urgent } : {}),
        ...(dto.assigneeId !== undefined ? { assigneeId: dto.assigneeId } : {}),
      },
      include: taskInclude,
    });
    await this.logTaskUpdate(before, task, user);
    return task;
  }

  async remove(id: string, user: AuthenticatedUser) {
    const task = await this.findManual(id);
    await this.prisma.pendingTask.delete({ where: { id } });
    await this.audit.logDelete('PendingTask', id, task as unknown as Record<string, unknown>, user);
    return { ok: true };
  }

  // ---------------------------------------------------------------------------
  // Ações sobre qualquer pendência (manual ou gerada)
  // ---------------------------------------------------------------------------

  async resolve(key: string, user: AuthenticatedUser) {
    const resolution = { resolvedAt: new Date(), resolvedById: user.id, resolvedByName: user.name };
    if (key.startsWith(MANUAL_PREFIX)) {
      const before = await this.findManual(key.slice(MANUAL_PREFIX.length));
      if (before.resolvedAt) return before;
      const task = await this.prisma.pendingTask.update({
        where: { id: before.id },
        data: resolution,
        include: taskInclude,
      });
      await this.logTaskUpdate(before, task, user);
      return task;
    }
    return this.upsertGenerated(key, user, resolution);
  }

  async assign(dto: AssignPendingDto, user: AuthenticatedUser) {
    await this.assertUser(dto.assigneeId);
    const assigneeId = dto.assigneeId ?? null;
    if (dto.key.startsWith(MANUAL_PREFIX)) {
      return this.update(dto.key.slice(MANUAL_PREFIX.length), { assigneeId }, user);
    }
    return this.upsertGenerated(dto.key, user, { assigneeId });
  }

  async reopen(id: string, user: AuthenticatedUser) {
    const before = await this.prisma.pendingTask.findUnique({ where: { id }, include: taskInclude });
    if (!before) throw new NotFoundException('Pendência não encontrada');
    const task = await this.prisma.pendingTask.update({
      where: { id },
      data: { resolvedAt: null, resolvedById: null, resolvedByName: null },
      include: taskInclude,
    });
    await this.logTaskUpdate(before, task, user);
    return task;
  }

  /** Grava o estado de uma pendência gerada, com um retrato do título/categoria para o histórico. */
  private async upsertGenerated(
    key: string,
    user: AuthenticatedUser,
    data: { assigneeId?: string | null; resolvedAt?: Date; resolvedById?: string; resolvedByName?: string },
  ) {
    const existing = await this.prisma.pendingTask.findFirst({ where: { sourceKey: key }, include: taskInclude });
    if (existing) {
      const task = await this.prisma.pendingTask.update({ where: { id: existing.id }, data, include: taskInclude });
      await this.logTaskUpdate(existing, task, user);
      return task;
    }

    const rules = await this.getRules();
    const item = (await this.generate(rules, user, brazilToday())).find((g) => g.key === key);
    if (!item?.rule) throw new NotFoundException('Pendência não encontrada');
    const ruleAssigneeId = rules.find((r) => r.rule === item.rule)?.assigneeId;
    const task = await this.prisma.pendingTask.create({
      data: {
        rule: item.rule,
        sourceKey: key,
        title: item.title,
        description: item.subtitle,
        category: item.category,
        dueDate: item.dueDate ? new Date(`${item.dueDate}T00:00:00Z`) : null,
        link: item.link,
        assigneeId: ruleAssigneeId ?? item.assignee?.id ?? null,
        createdById: user.id,
        ...data,
      },
      include: taskInclude,
    });
    await this.audit.logCreate('PendingTask', task.id, task as unknown as Record<string, unknown>, user);
    return task;
  }

  // ---------------------------------------------------------------------------
  // Geração a partir das regras
  // ---------------------------------------------------------------------------

  private async generate(rules: PendingRuleConfig[], user: AuthenticatedUser, today: string) {
    const active = rules.filter((r) => r.enabled && user.permissions.includes(RULE_DEFS[r.rule].permission));
    const param = (rule: PendingRule) => active.find((r) => r.rule === rule)?.param ?? RULE_DEFS[rule].param ?? 0;
    const generators: Record<PendingRule, () => Promise<Omit<PendingItem, 'taskId'>[]>> = {
      LOW_STOCK: () => this.lowStock(param('LOW_STOCK')),
      EXPIRING_STOCK: () => this.expiringStock(today, param('EXPIRING_STOCK')),
      BILLS_DUE: () => this.billsDue(today, param('BILLS_DUE')),
      APPOINTMENT_NO_OUTCOME: () => this.appointmentsWithoutOutcome(user),
      EQUIPMENT_MAINTENANCE: () => this.equipmentMaintenance(today, param('EQUIPMENT_MAINTENANCE')),
      DOCUMENT_UNSIGNED: () => this.unsignedDocuments(),
      COMMEMORATIVE_DATE: () => this.commemorativeDates(today, param('COMMEMORATIVE_DATE')),
    };
    const results = await Promise.all(active.map((r) => generators[r.rule]()));
    return results.flat();
  }

  private base(rule: PendingRule) {
    return {
      rule,
      category: RULE_DEFS[rule].category,
      description: null,
      urgent: false,
      assignee: null,
    };
  }

  private async lowStock(margin: number) {
    const items = await this.prisma.inventoryItem.findMany({
      where: { minQuantity: { gt: 0 } },
      include: { movements: { where: { type: 'IN' }, orderBy: { createdAt: 'desc' }, take: 1, select: { id: true } } },
      orderBy: { name: 'asc' },
    });
    return items
      .filter((i) => Number(i.quantity) <= Number(i.minQuantity) + margin)
      .map((i) => ({
        ...this.base('LOW_STOCK'),
        // A última entrada faz a pendência voltar se o item ficar baixo de novo depois de resolvida.
        key: `LOW_STOCK:${i.id}:${i.movements[0]?.id ?? 'none'}`,
        group: (Number(i.quantity) <= 0 ? 'OVERDUE' : 'URGENT') as PendingGroup,
        title: `Repor ${i.name}`,
        subtitle: `${formatQty(i.quantity)} ${i.unit ?? 'un'} em estoque · mínimo ${formatQty(i.minQuantity)}`,
        deadlineLabel: Number(i.quantity) <= 0 ? 'Sem estoque' : 'Estoque atual abaixo do mínimo',
        dueDate: null,
        link: `/estoque/${i.id}`,
      }));
  }

  private async expiringStock(today: string, days: number) {
    const items = await this.prisma.inventoryItem.findMany({
      where: {
        quantity: { gt: 0 },
        expiresAt: { not: null, lt: new Date(`${addDays(today, days + 1)}T00:00:00Z`) },
      },
      orderBy: { expiresAt: 'asc' },
    });
    return items.map((i) => {
      const due = dateKey(i.expiresAt as Date);
      const { group, label } = byDueDate(today, due, { past: 'Venceu', future: 'Vence' });
      return {
        ...this.base('EXPIRING_STOCK'),
        key: `EXPIRING_STOCK:${i.id}:${due}`,
        group,
        title: `Validade próxima · ${i.name}`,
        subtitle: `${formatQty(i.quantity)} ${i.unit ?? 'un'} em estoque`,
        deadlineLabel: label,
        dueDate: due,
        link: `/estoque/${i.id}`,
      };
    });
  }

  private async billsDue(today: string, days: number) {
    const limit = addDays(today, days);
    const entries = await this.finance.listUpcomingUnpaidExpenses(undefined, `${limit}T23:59:59.999Z`);
    const items: Omit<PendingItem, 'taskId'>[] = entries.map((e) => {
      const due = dateKey(e.dueDate as Date);
      const { group, label } = byDueDate(today, due, { past: 'Venceu', future: 'Vence' });
      return {
        ...this.base('BILLS_DUE'),
        key: `BILLS_DUE:${e.id}`,
        group,
        title: `Pagar ${e.description}`,
        subtitle: formatMoney(e.amount),
        deadlineLabel: label,
        dueDate: due,
        link: '/financeiro',
      };
    });

    // Despesas recorrentes cujo lançamento do mês ainda não foi gerado no financeiro.
    const recurring = await this.prisma.recurringExpense.findMany({ where: { active: true } });
    if (recurring.length === 0) return items;
    const months = [today.slice(0, 7), limit.slice(0, 7)].filter((m, i, arr) => arr.indexOf(m) === i);
    const [lastYear, lastMonth] = months[months.length - 1].split('-').map(Number);
    const generated = await this.prisma.financialEntry.findMany({
      where: {
        recurringExpenseId: { in: recurring.map((r) => r.id) },
        dueDate: { gte: new Date(`${months[0]}-01T00:00:00Z`), lt: new Date(Date.UTC(lastYear, lastMonth, 1)) },
      },
      select: { recurringExpenseId: true, dueDate: true },
    });
    const done = new Set(generated.map((g) => `${g.recurringExpenseId}:${dateKey(g.dueDate as Date).slice(0, 7)}`));
    for (const month of months) {
      const [y, m] = month.split('-').map(Number);
      const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
      for (const r of recurring) {
        if (done.has(`${r.id}:${month}`)) continue;
        const due = `${month}-${String(Math.min(r.dueDay, lastDay)).padStart(2, '0')}`;
        if (due > limit) continue;
        const { group, label } = byDueDate(today, due, { past: 'Venceu', future: 'Vence' });
        items.push({
          ...this.base('BILLS_DUE'),
          key: `BILLS_DUE:recurring:${r.id}:${month}`,
          group,
          title: `Pagar ${r.name}`,
          subtitle: `${formatMoney(r.amount)} · despesa recorrente ainda não lançada`,
          deadlineLabel: label,
          dueDate: due,
          link: '/despesas-recorrentes',
        });
      }
    }
    return items;
  }

  private async appointmentsWithoutOutcome(user: AuthenticatedUser) {
    const appts = await this.appointments.pending(user.restrictToOwnAppointments ? user.id : undefined);
    return appts.map((a) => {
      const start = new Date(a.startAt.getTime() - BRAZIL_OFFSET_MS).toISOString();
      const day = start.slice(0, 10);
      return {
        ...this.base('APPOINTMENT_NO_OUTCOME'),
        key: `APPOINTMENT:${a.id}`,
        group: 'OVERDUE' as PendingGroup,
        title: `Fechar atendimento de ${a.patient?.name ?? 'paciente'}`,
        subtitle: [a.procedure?.name, `${formatDay(day)} ${start.slice(11, 16)}`].filter(Boolean).join(' · '),
        deadlineLabel: `Sem desfecho desde ${formatDay(day)}`,
        dueDate: day,
        link: '/agenda',
        assignee: a.professional ?? null,
      };
    });
  }

  private async equipmentMaintenance(today: string, days: number) {
    const limit = new Date(`${addDays(today, days + 1)}T00:00:00Z`);
    const list = await this.prisma.equipment.findMany({
      where: {
        active: true,
        OR: [
          { scheduledMaintenanceAt: { lt: limit } },
          { scheduledMaintenanceAt: null, nextMaintenanceAt: { lt: limit } },
        ],
      },
      orderBy: { name: 'asc' },
    });
    return list.map((eq) => {
      const scheduled = !!eq.scheduledMaintenanceAt;
      const due = dateKey((eq.scheduledMaintenanceAt ?? eq.nextMaintenanceAt) as Date);
      const { group, label } = byDueDate(today, due, { past: 'Prevista', future: 'Manutenção' });
      return {
        ...this.base('EQUIPMENT_MAINTENANCE'),
        key: `EQUIPMENT:${eq.id}:${due}`,
        group,
        title: `Manutenção · ${eq.name}`,
        subtitle: [scheduled ? 'Manutenção agendada' : 'Manutenção periódica', [eq.brand, eq.model].filter(Boolean).join(' ')]
          .filter(Boolean)
          .join(' · '),
        deadlineLabel: label,
        dueDate: due,
        link: '/equipamentos',
      };
    });
  }

  private async unsignedDocuments() {
    const docs = await this.prisma.document.findMany({
      where: { status: { in: [DocumentStatus.PENDING, DocumentStatus.SENT] } },
      include: { patient: { select: { name: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return docs.map((d) => {
      const created = new Date(d.createdAt.getTime() - BRAZIL_OFFSET_MS).toISOString().slice(0, 10);
      const sent = d.status === DocumentStatus.SENT;
      return {
        ...this.base('DOCUMENT_UNSIGNED'),
        key: `DOCUMENT:${d.id}`,
        // Pendente ainda nem foi enviado ao paciente; enviado só aguarda a assinatura.
        group: (sent ? 'UPCOMING' : 'URGENT') as PendingGroup,
        title: `Assinatura pendente · ${d.name}`,
        subtitle: [d.patient?.name, sent ? 'Enviado ao paciente' : 'Ainda não enviado'].filter(Boolean).join(' · '),
        deadlineLabel: `${sent ? 'Aguardando assinatura desde' : 'Criado em'} ${formatDay(created)}`,
        dueDate: null,
        link: `/documentos?status=${d.status}&busca=${encodeURIComponent(d.name)}`,
      };
    });
  }

  private async commemorativeDates(today: string, days: number) {
    const limit = addDays(today, days);
    const dates = upcomingCommemorativeDates(today).filter((d) => d.day <= limit);
    if (dates.length === 0) return [];
    // Vinculada = promoção ainda vigente com a mesma data comemorativa (campo da tela de promoções).
    const promotions = await this.prisma.promotion.findMany({
      where: { endAt: { gte: new Date(`${today}T00:00:00Z`) }, commemorativeDate: { not: null } },
      select: { commemorativeDate: true },
    });
    const normalize = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
    const linked = new Set(promotions.map((p) => normalize(p.commemorativeDate as string)));
    return dates
      .filter((d) => !linked.has(normalize(d.name)))
      .map((d) => {
        const { group, label } = byDueDate(today, d.day, { past: 'Foi', future: 'Acontece' });
        return {
          ...this.base('COMMEMORATIVE_DATE'),
          key: `COMMEMORATIVE:${d.name}:${d.day}`,
          group,
          title: `Criar promoção · ${d.name}`,
          subtitle: `Nenhuma promoção para ${formatDay(d.day)}`,
          deadlineLabel: label,
          dueDate: d.day,
          link: `/promocoes?data=${encodeURIComponent(d.name)}`,
        };
      });
  }

  // ---------------------------------------------------------------------------
  // Auxiliares
  // ---------------------------------------------------------------------------

  private manualItem(t: TaskWithAssignee, today: string): PendingItem {
    const due = t.dueDate ? dateKey(t.dueDate) : null;
    let group: PendingGroup = t.urgent ? 'URGENT' : 'UPCOMING';
    let deadlineLabel = 'Sem prazo definido';
    if (due) {
      const byDate = byDueDate(today, due, { past: 'Venceu', future: 'Vence' });
      group = byDate.group === 'UPCOMING' && t.urgent ? 'URGENT' : byDate.group;
      deadlineLabel = byDate.label;
    }
    return {
      key: `${MANUAL_PREFIX}${t.id}`,
      taskId: t.id,
      rule: null,
      category: t.category,
      group,
      title: t.title,
      subtitle: null,
      description: t.description,
      deadlineLabel,
      dueDate: due,
      urgent: t.urgent,
      link: null,
      assignee: t.assignee,
    };
  }

  private async findManual(id: string) {
    const task = await this.prisma.pendingTask.findUnique({ where: { id }, include: taskInclude });
    if (!task || task.sourceKey) throw new NotFoundException('Pendência não encontrada');
    return task;
  }

  private async assertUser(id?: string | null) {
    if (!id) return;
    const exists = await this.prisma.user.count({ where: { id } });
    if (!exists) throw new BadRequestException('Responsável inválido');
  }

  private async usersById(ids: (string | null)[]) {
    const wanted = [...new Set(ids.filter((id): id is string => !!id))];
    if (wanted.length === 0) return new Map<string, { id: string; name: string }>();
    const users = await this.prisma.user.findMany({ where: { id: { in: wanted } }, select: { id: true, name: true } });
    return new Map(users.map((u) => [u.id, u]));
  }

  private logTaskUpdate(before: PendingTask, after: PendingTask, user: AuthenticatedUser) {
    return this.audit.logUpdate(
      'PendingTask',
      after.id,
      before as unknown as Record<string, unknown>,
      after as unknown as Record<string, unknown>,
      user,
    );
  }
}
