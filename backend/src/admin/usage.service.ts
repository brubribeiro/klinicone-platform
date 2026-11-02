import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import {
  PLATFORM_FEATURES,
  PLATFORM_FEATURE_LABELS,
  featuresFromTenant,
  type PlatformFeature,
} from '../common/platform-features';
import { TenantContext } from '../tenancy/tenant-context';
import { featureFromRoute } from '../observability/route-feature';

const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

type UsageModel =
  | 'appointment'
  | 'patient'
  | 'procedure'
  | 'patientPackage'
  | 'promotion'
  | 'skincareRoutine'
  | 'unavailability'
  | 'equipment'
  | 'inventoryMovement'
  | 'financialEntry'
  | 'recurringExpense'
  | 'paymentMethod'
  | 'goal'
  | 'document'
  | 'messageTemplate';

/**
 * Registro que mede o uso de cada módulo: contagem no período (pela data indicada) e total.
 * Só contagens agregadas por clínica — nenhum dado de paciente/agenda sai daqui.
 * null = módulo sem registro próprio no banco (ex.: Métricas só lê dados dos outros).
 */
export const MODULE_USAGE_SOURCES: Record<
  PlatformFeature,
  { model: UsageModel; dateField: 'createdAt' | 'startAt' | 'purchaseDate'; metricLabel: string } | null
> = {
  appointments: { model: 'appointment', dateField: 'startAt', metricLabel: 'Agendamentos' },
  patients: { model: 'patient', dateField: 'createdAt', metricLabel: 'Pacientes cadastrados' },
  procedures: { model: 'procedure', dateField: 'createdAt', metricLabel: 'Procedimentos cadastrados' },
  packages: { model: 'patientPackage', dateField: 'purchaseDate', metricLabel: 'Pacotes vendidos' },
  promotions: { model: 'promotion', dateField: 'createdAt', metricLabel: 'Promoções criadas' },
  routines: { model: 'skincareRoutine', dateField: 'createdAt', metricLabel: 'Rotinas criadas' },
  availability: { model: 'unavailability', dateField: 'createdAt', metricLabel: 'Bloqueios de agenda' },
  equipment: { model: 'equipment', dateField: 'createdAt', metricLabel: 'Equipamentos cadastrados' },
  inventory: { model: 'inventoryMovement', dateField: 'createdAt', metricLabel: 'Movimentações de estoque' },
  finance: { model: 'financialEntry', dateField: 'createdAt', metricLabel: 'Lançamentos financeiros' },
  recurring_expenses: { model: 'recurringExpense', dateField: 'createdAt', metricLabel: 'Despesas recorrentes' },
  payment_methods: { model: 'paymentMethod', dateField: 'createdAt', metricLabel: 'Formas de pagamento' },
  metrics: null,
  goals: { model: 'goal', dateField: 'createdAt', metricLabel: 'Metas criadas' },
  documents: { model: 'document', dateField: 'createdAt', metricLabel: 'Documentos enviados' },
  messages: { model: 'messageTemplate', dateField: 'createdAt', metricLabel: 'Modelos de mensagem' },
};

type CountRow = { tenantId: string; _count: { _all: number } };
type GroupByDelegate = { groupBy: (args: unknown) => Promise<CountRow[]> };

export type UsageRange = { from: string; to: string; gte: Date; lt: Date };

/** "2026-10-01".."2026-10-31" em dias do Brasil (UTC-3, sem horário de verão); padrão = mês corrente. */
export function parseUsageRange(from?: string, to?: string, now = new Date()): UsageRange {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(now);
  const monthStart = `${today.slice(0, 8)}01`;
  const fromDay = from || monthStart;
  const toDay = to || (from ? today : lastDayOfMonth(monthStart));
  for (const day of [fromDay, toDay]) {
    if (!DATE_PATTERN.test(day) || Number.isNaN(brazilDayStart(day).getTime())) {
      throw new BadRequestException('Data inválida (use AAAA-MM-DD).');
    }
  }
  if (fromDay > toDay) throw new BadRequestException('A data inicial deve ser anterior à final.');
  return {
    from: fromDay,
    to: toDay,
    gte: brazilDayStart(fromDay),
    lt: new Date(brazilDayStart(toDay).getTime() + DAY_MS),
  };
}

function brazilDayStart(day: string) {
  return new Date(`${day}T00:00:00-03:00`);
}

function lastDayOfMonth(monthStart: string) {
  const [y, m] = monthStart.split('-').map(Number);
  return `${monthStart.slice(0, 8)}${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, '0')}`;
}

function countMap(rows: CountRow[]) {
  return new Map(rows.map((r) => [r.tenantId, r._count._all]));
}

/**
 * Uso da plataforma por módulo (super-admin): contagens agregadas por clínica,
 * derivadas dos dados que já existem (sem telemetria de clique).
 */
@Injectable()
export class UsageService {
  constructor(private readonly prisma: PrismaService) {}

  getUsage(params: { from?: string; to?: string; tenantId?: string }) {
    const range = parseUsageRange(params.from, params.to);
    return TenantContext.runUnscoped(async () => {
      const tenants = await this.prisma.tenant.findMany({
        where: params.tenantId ? { id: params.tenantId } : undefined,
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          slug: true,
          active: true,
          planId: true,
          featuresExtra: true,
          featuresDenied: true,
          plan: { select: { id: true, name: true, features: true } },
        },
      });
      if (params.tenantId && !tenants.length) throw new NotFoundException('Clínica não encontrada.');

      const tenantWhere = params.tenantId ? { tenantId: params.tenantId } : {};
      const period = { gte: range.gte, lt: range.lt };
      const sources = PLATFORM_FEATURES.flatMap((key) => {
        const source = MODULE_USAGE_SOURCES[key];
        return source ? [{ key, ...source }] : [];
      });

      const groupCount = (model: UsageModel, where: Record<string, unknown>) =>
        (this.prisma[model] as unknown as GroupByDelegate).groupBy({
          by: ['tenantId'],
          where: { ...tenantWhere, ...where },
          _count: { _all: true },
        });

      const [moduleCounts, activeUsers, accessedUsers, lastAccess, documents, photos, routeRequests] = await Promise.all([
        Promise.all(
          sources.map(async (s) => {
            const [inPeriod, total] = await Promise.all([
              groupCount(s.model, { [s.dateField]: period }),
              groupCount(s.model, {}),
            ]);
            return { key: s.key, period: countMap(inPeriod), total: countMap(total) };
          }),
        ),
        this.prisma.user.groupBy({ by: ['tenantId'], where: { ...tenantWhere, active: true }, _count: { _all: true } }),
        this.prisma.user.groupBy({
          by: ['tenantId'],
          where: { ...tenantWhere, active: true, lastAccessAt: period },
          _count: { _all: true },
        }),
        this.prisma.user.groupBy({ by: ['tenantId'], where: tenantWhere, _max: { lastAccessAt: true } }),
        this.prisma.document.groupBy({
          by: ['tenantId'],
          where: tenantWhere,
          _sum: { size: true },
          _count: { _all: true },
        }),
        this.prisma.patientPhoto.groupBy({
          by: ['tenantId'],
          where: tenantWhere,
          _sum: { size: true },
          _count: { _all: true },
        }),
        // Requisições à API no período (medidas desde a observabilidade, issue #84)
        this.prisma.apiRouteMetric.groupBy({
          by: ['route'],
          where: { hour: period, ...(params.tenantId ? { tenantKey: params.tenantId } : {}) },
          _sum: { count: true },
        }),
      ]);

      const countsByKey = new Map(moduleCounts.map((c) => [c.key, c]));
      const activeUsersBy = countMap(activeUsers as CountRow[]);
      const accessedUsersBy = countMap(accessedUsers as CountRow[]);
      const lastAccessBy = new Map(lastAccess.map((r) => [r.tenantId, r._max.lastAccessAt]));
      const documentsBy = new Map(documents.map((r) => [r.tenantId, r]));
      const photosBy = new Map(photos.map((r) => [r.tenantId, r]));
      const requestsBy = new Map<PlatformFeature, number>();
      for (const r of routeRequests) {
        const feature = featureFromRoute(r.route);
        if (feature) requestsBy.set(feature, (requestsBy.get(feature) ?? 0) + (r._sum.count ?? 0));
      }

      const tenantRows = tenants.map(({ plan, featuresExtra, featuresDenied, planId, ...tenant }) => {
        const features = featuresFromTenant({ planId, featuresExtra, featuresDenied, plan });
        const doc = documentsBy.get(tenant.id);
        const photo = photosBy.get(tenant.id);
        const usage = {} as Record<PlatformFeature, { period: number; total: number } | null>;
        for (const key of PLATFORM_FEATURES) {
          const counts = countsByKey.get(key);
          usage[key] = counts
            ? { period: counts.period.get(tenant.id) ?? 0, total: counts.total.get(tenant.id) ?? 0 }
            : null;
        }
        return {
          ...tenant,
          plan: plan ? { id: plan.id, name: plan.name } : null,
          features,
          activeUsers: activeUsersBy.get(tenant.id) ?? 0,
          usersAccessedInPeriod: accessedUsersBy.get(tenant.id) ?? 0,
          lastAccessAt: lastAccessBy.get(tenant.id) ?? null,
          // Documentos e fotos de pacientes no R2 (bytes informados no upload)
          storageBytes: (doc?._sum.size ?? 0) + (photo?._sum.size ?? 0),
          files: (doc?._count._all ?? 0) + (photo?._count._all ?? 0),
          usage,
        };
      });

      const modules = PLATFORM_FEATURES.map((key) => {
        const source = MODULE_USAGE_SOURCES[key];
        let periodCount: number | null = null;
        let totalCount: number | null = null;
        let activeTenants: number | null = null;
        if (source) {
          periodCount = totalCount = activeTenants = 0;
          for (const t of tenantRows) {
            const u = t.usage[key]!;
            periodCount += u.period;
            totalCount += u.total;
            if (u.period > 0) activeTenants++;
          }
        }
        return {
          key,
          label: PLATFORM_FEATURE_LABELS[key],
          metricLabel: source?.metricLabel ?? null,
          enabledTenants: tenantRows.filter((t) => t.features.includes(key)).length,
          activeTenants,
          periodCount,
          totalCount,
          requests: requestsBy.get(key) ?? 0,
        };
      });

      const sum = (pick: (t: (typeof tenantRows)[number]) => number) =>
        tenantRows.reduce((acc, t) => acc + pick(t), 0);

      return {
        range: { from: range.from, to: range.to },
        totals: {
          tenants: tenantRows.length,
          activeTenants: tenantRows.filter((t) => t.active).length,
          activeUsers: sum((t) => t.activeUsers),
          usersAccessedInPeriod: sum((t) => t.usersAccessedInPeriod),
          storageBytes: sum((t) => t.storageBytes),
          files: sum((t) => t.files),
        },
        modules,
        tenants: tenantRows,
      };
    });
  }
}
