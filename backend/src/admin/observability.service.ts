import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../tenancy/tenant-context';
import {
  OBSERVABILITY_RETENTION_DAYS,
  percentileFromHistogram,
} from '../observability/api-metrics.service';

const HOUR_MS = 60 * 60 * 1000;
const TOP_ROUTES = 10;
const RECENT_ERRORS = 50;

export const OBSERVABILITY_WINDOWS_HOURS = [24, 24 * 7, 24 * OBSERVABILITY_RETENTION_DAYS] as const;

const HISTOGRAM_FIELDS = ['le50', 'le100', 'le250', 'le500', 'le1000', 'le2500', 'le5000', 'gt5000'] as const;

type MetricSums = { count: number; clientErrors: number; serverErrors: number; totalMs: number } & Record<
  (typeof HISTOGRAM_FIELDS)[number],
  number
>;

function summarize(sums: MetricSums, maxMs: number) {
  return {
    count: sums.count,
    clientErrors: sums.clientErrors,
    serverErrors: sums.serverErrors,
    errorRate: sums.count ? sums.serverErrors / sums.count : 0,
    avgMs: sums.count ? Math.round(sums.totalMs / sums.count) : null,
    p95Ms: percentileFromHistogram(
      HISTOGRAM_FIELDS.map((f) => sums[f]),
      maxMs,
    ),
    maxMs: sums.count ? maxMs : null,
  };
}

/**
 * Saúde da API para o super-admin: totais, rotas mais lentas (p95), rotas com erro 5xx e
 * os últimos erros. Só padrões de rota e contagens — nada do corpo/parâmetros das requisições.
 */
@Injectable()
export class ObservabilityService {
  constructor(private readonly prisma: PrismaService) {}

  getOverview(params: { hours?: number }, now = new Date()) {
    const hours = params.hours ?? OBSERVABILITY_WINDOWS_HOURS[0];
    // Buckets são por hora: a janela começa no início da hora (inclui a hora corrente)
    const since = new Date(Math.floor(now.getTime() / HOUR_MS) * HOUR_MS - (hours - 1) * HOUR_MS);

    return TenantContext.runUnscoped(async () => {
      const [byRoute, recentErrors] = await Promise.all([
        this.prisma.apiRouteMetric.groupBy({
          by: ['method', 'route'],
          where: { hour: { gte: since } },
          _sum: {
            count: true,
            clientErrors: true,
            serverErrors: true,
            totalMs: true,
            le50: true,
            le100: true,
            le250: true,
            le500: true,
            le1000: true,
            le2500: true,
            le5000: true,
            gt5000: true,
          },
          _max: { maxMs: true },
        }),
        this.prisma.apiRequestError.findMany({
          where: { createdAt: { gte: since } },
          orderBy: { createdAt: 'desc' },
          take: RECENT_ERRORS,
          select: {
            id: true,
            createdAt: true,
            method: true,
            route: true,
            statusCode: true,
            durationMs: true,
            errorName: true,
            message: true,
            targetTenant: { select: { id: true, name: true } },
          },
        }),
      ]);

      const total = { count: 0, clientErrors: 0, serverErrors: 0, totalMs: 0 } as MetricSums;
      for (const f of HISTOGRAM_FIELDS) total[f] = 0;
      let totalMax = 0;

      const routes = byRoute.map((row) => {
        const sums = row._sum as unknown as MetricSums;
        const maxMs = row._max.maxMs ?? 0;
        for (const key of Object.keys(total) as (keyof MetricSums)[]) total[key] += sums[key] ?? 0;
        totalMax = Math.max(totalMax, maxMs);
        return { method: row.method, route: row.route, ...summarize(sums, maxMs) };
      });

      const slowRoutes = [...routes]
        .sort((a, b) => (b.p95Ms ?? 0) - (a.p95Ms ?? 0) || (b.avgMs ?? 0) - (a.avgMs ?? 0))
        .slice(0, TOP_ROUTES);
      const errorRoutes = routes
        .filter((r) => r.serverErrors > 0)
        .sort((a, b) => b.serverErrors - a.serverErrors || b.errorRate - a.errorRate)
        .slice(0, TOP_ROUTES);

      return {
        window: { hours, since: since.toISOString() },
        totals: { ...summarize(total, totalMax), routes: routes.length },
        slowRoutes,
        errorRoutes,
        recentErrors: recentErrors.map(({ targetTenant, ...e }) => ({ ...e, tenant: targetTenant })),
      };
    });
  }
}
