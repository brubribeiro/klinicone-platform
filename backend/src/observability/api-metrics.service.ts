import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../tenancy/tenant-context';

const FLUSH_INTERVAL_MS = 60 * 1000;
const PURGE_INTERVAL_MS = 6 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
export const OBSERVABILITY_RETENTION_DAYS = 30;
/** Teto de erros gravados por minuto: numa avalanche as contagens seguem certas, a lista não explode. */
const MAX_ERRORS_PER_FLUSH = 100;
const MESSAGE_MAX_LENGTH = 200;

/** Faixas do histograma de duração (ms); a última (gt5000) não tem limite. */
export const LATENCY_BUCKETS_MS = [50, 100, 250, 500, 1000, 2500, 5000] as const;

export type RequestSample = {
  method: string;
  route: string;
  statusCode: number;
  durationMs: number;
  tenantId: string | null;
  error?: unknown;
};

type Bucket = {
  hour: Date;
  method: string;
  route: string;
  tenantKey: string;
  count: number;
  clientErrors: number;
  serverErrors: number;
  totalMs: number;
  maxMs: number;
  histogram: number[];
};

type ErrorRow = {
  method: string;
  route: string;
  statusCode: number;
  durationMs: number;
  errorName: string | null;
  message: string | null;
  targetTenantId: string | null;
  createdAt: Date;
};

export function latencyBucketIndex(durationMs: number) {
  const i = LATENCY_BUCKETS_MS.findIndex((limit) => durationMs <= limit);
  return i === -1 ? LATENCY_BUCKETS_MS.length : i;
}

/**
 * Percentil estimado pelo histograma: limite superior da faixa que alcança o percentil
 * (nunca acima do máximo observado). null sem requisições.
 */
export function percentileFromHistogram(histogram: number[], maxMs: number, p = 0.95): number | null {
  const total = histogram.reduce((a, b) => a + b, 0);
  if (!total) return null;
  const target = Math.ceil(total * p);
  let acc = 0;
  for (let i = 0; i < histogram.length; i++) {
    acc += histogram[i];
    if (acc >= target) return Math.min(LATENCY_BUCKETS_MS[i] ?? maxMs, maxMs);
  }
  return maxMs;
}

/**
 * Tipo do erro e só a 1ª linha da mensagem: mensagens do Prisma trazem os argumentos da
 * consulta no meio (podem ter dados de paciente); delas fica também a última linha, a causa.
 */
export function describeError(error: unknown): { errorName: string | null; message: string | null } {
  if (!error || typeof error !== 'object') return { errorName: null, message: null };
  const err = error as { name?: unknown; code?: unknown; message?: unknown };
  const name = typeof err.name === 'string' ? err.name : error.constructor?.name ?? null;
  const code = typeof err.code === 'string' ? err.code : null;
  const lines =
    typeof err.message === 'string'
      ? err.message
          .split('\n')
          .map((l) => l.trim())
          .filter(Boolean)
      : [];
  let message = lines[0] ?? null;
  // "Invalid `prisma.user.findUnique()` invocation in" ... "Server has closed the connection."
  if (message?.startsWith('Invalid `') && lines.length > 1) message = `${message} … ${lines[lines.length - 1]}`;
  return {
    errorName: name ? (code ? `${name} (${code})` : name) : code,
    message: message ? message.slice(0, MESSAGE_MAX_LENGTH) : null,
  };
}

/**
 * Métricas de requisições da API (painel super-admin): acumula em memória por hora/rota/clínica
 * e grava a cada minuto. Guarda os erros 5xx recentes. Retenção de 30 dias.
 */
@Injectable()
export class ApiMetricsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ApiMetricsService.name);
  private buckets = new Map<string, Bucket>();
  private errors: ErrorRow[] = [];
  private flushRef: ReturnType<typeof setInterval> | null = null;
  private flushing: Promise<void> | null = null;
  private lastPurgeAt = 0;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    this.flushRef = setInterval(() => void this.flush(), FLUSH_INTERVAL_MS);
    this.flushRef.unref();
  }

  async onModuleDestroy() {
    if (this.flushRef) clearInterval(this.flushRef);
    await this.flush();
  }

  record(sample: RequestSample) {
    const now = Date.now();
    const hour = new Date(Math.floor(now / HOUR_MS) * HOUR_MS);
    const tenantKey = sample.tenantId ?? '';
    const key = `${hour.getTime()}|${sample.method}|${sample.route}|${tenantKey}`;
    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = {
        hour,
        method: sample.method,
        route: sample.route,
        tenantKey,
        count: 0,
        clientErrors: 0,
        serverErrors: 0,
        totalMs: 0,
        maxMs: 0,
        histogram: new Array(LATENCY_BUCKETS_MS.length + 1).fill(0),
      };
      this.buckets.set(key, bucket);
    }
    const durationMs = Math.max(0, Math.round(sample.durationMs));
    bucket.count++;
    if (sample.statusCode >= 500) bucket.serverErrors++;
    else if (sample.statusCode >= 400) bucket.clientErrors++;
    bucket.totalMs += durationMs;
    bucket.maxMs = Math.max(bucket.maxMs, durationMs);
    bucket.histogram[latencyBucketIndex(durationMs)]++;

    if (sample.statusCode >= 500 && this.errors.length < MAX_ERRORS_PER_FLUSH) {
      this.errors.push({
        method: sample.method,
        route: sample.route,
        statusCode: sample.statusCode,
        durationMs,
        targetTenantId: sample.tenantId,
        createdAt: new Date(now),
        ...describeError(sample.error),
      });
    }
  }

  /** Grava o que está em memória (um flush por vez). Falha só vai pro log: métrica não derruba a API. */
  flush(): Promise<void> {
    if (this.flushing) return this.flushing;
    this.flushing = this.persist()
      .catch((e) => this.logger.error('Falha ao gravar métricas da API', e))
      .finally(() => {
        this.flushing = null;
      });
    return this.flushing;
  }

  private async persist() {
    const buckets = [...this.buckets.values()];
    const errors = this.errors;
    this.buckets = new Map();
    this.errors = [];

    await TenantContext.runUnscoped(async () => {
      for (const b of buckets) {
        const [le50, le100, le250, le500, le1000, le2500, le5000, gt5000] = b.histogram;
        await this.prisma.$executeRaw`
          INSERT INTO "api_route_metrics" (
            "id", "hour", "method", "route", "tenantKey", "count", "clientErrors", "serverErrors",
            "totalMs", "maxMs", "le50", "le100", "le250", "le500", "le1000", "le2500", "le5000", "gt5000"
          ) VALUES (
            gen_random_uuid()::text, ${b.hour}, ${b.method}, ${b.route}, ${b.tenantKey}, ${b.count},
            ${b.clientErrors}, ${b.serverErrors}, ${b.totalMs}, ${b.maxMs}, ${le50}, ${le100}, ${le250},
            ${le500}, ${le1000}, ${le2500}, ${le5000}, ${gt5000}
          )
          ON CONFLICT ("hour", "method", "route", "tenantKey") DO UPDATE SET
            "count" = "api_route_metrics"."count" + EXCLUDED."count",
            "clientErrors" = "api_route_metrics"."clientErrors" + EXCLUDED."clientErrors",
            "serverErrors" = "api_route_metrics"."serverErrors" + EXCLUDED."serverErrors",
            "totalMs" = "api_route_metrics"."totalMs" + EXCLUDED."totalMs",
            "maxMs" = GREATEST("api_route_metrics"."maxMs", EXCLUDED."maxMs"),
            "le50" = "api_route_metrics"."le50" + EXCLUDED."le50",
            "le100" = "api_route_metrics"."le100" + EXCLUDED."le100",
            "le250" = "api_route_metrics"."le250" + EXCLUDED."le250",
            "le500" = "api_route_metrics"."le500" + EXCLUDED."le500",
            "le1000" = "api_route_metrics"."le1000" + EXCLUDED."le1000",
            "le2500" = "api_route_metrics"."le2500" + EXCLUDED."le2500",
            "le5000" = "api_route_metrics"."le5000" + EXCLUDED."le5000",
            "gt5000" = "api_route_metrics"."gt5000" + EXCLUDED."gt5000"
        `;
      }
      if (errors.length) await this.prisma.apiRequestError.createMany({ data: errors });

      if (Date.now() - this.lastPurgeAt >= PURGE_INTERVAL_MS) {
        this.lastPurgeAt = Date.now();
        const cutoff = new Date(Date.now() - OBSERVABILITY_RETENTION_DAYS * 24 * HOUR_MS);
        await this.prisma.apiRouteMetric.deleteMany({ where: { hour: { lt: cutoff } } });
        await this.prisma.apiRequestError.deleteMany({ where: { createdAt: { lt: cutoff } } });
      }
    });
  }
}
