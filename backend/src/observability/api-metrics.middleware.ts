import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

import { TenantContext } from '../tenancy/tenant-context';
import { ApiMetricsService } from './api-metrics.service';

/** Erro guardado pelo ApiErrorFilter para o registro do 5xx (tipo + 1ª linha da mensagem). */
export const API_ERROR_LOCAL = 'observabilityError';

/**
 * Mede cada requisição pelo padrão da rota (/api/patients/:id). Requisições sem rota
 * (404 de URL inexistente) e preflight CORS ficam de fora.
 */
@Injectable()
export class ApiMetricsMiddleware implements NestMiddleware {
  constructor(private readonly metrics: ApiMetricsService) {}

  use(req: Request, res: Response, next: NextFunction) {
    if (req.method === 'OPTIONS') return next();
    const start = process.hrtime.bigint();
    // O JwtAuthGuard preenche a clínica neste mesmo objeto depois do middleware
    const store = TenantContext.current();

    res.on('finish', () => {
      const route = (req.route as { path?: unknown } | undefined)?.path;
      if (typeof route !== 'string') return;
      this.metrics.record({
        method: req.method,
        route,
        statusCode: res.statusCode,
        durationMs: Number(process.hrtime.bigint() - start) / 1e6,
        tenantId: store?.tenantId ?? null,
        error: res.locals[API_ERROR_LOCAL],
      });
    });

    next();
  }
}
