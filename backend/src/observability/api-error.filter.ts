import { ArgumentsHost, Catch } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { Prisma } from '@prisma/client';
import type { Response } from 'express';

import { PrismaExceptionFilter } from '../common/filters/prisma-exception.filter';
import { API_ERROR_LOCAL } from './api-metrics.middleware';

/**
 * Filtro global: guarda o erro para o ApiMetricsMiddleware registrar o 5xx (inclusive os que
 * nascem nos guards, ex.: banco fora do ar no JwtAuthGuard) e responde como antes.
 */
@Catch()
export class ApiErrorFilter extends BaseExceptionFilter {
  private readonly prismaFilter = new PrismaExceptionFilter();

  catch(exception: unknown, host: ArgumentsHost) {
    if (host.getType() === 'http') host.switchToHttp().getResponse<Response>().locals[API_ERROR_LOCAL] = exception;
    if (exception instanceof Prisma.PrismaClientKnownRequestError) return this.prismaFilter.catch(exception, host);
    super.catch(exception, host);
  }
}
