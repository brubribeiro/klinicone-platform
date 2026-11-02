import { Prisma } from '@prisma/client';

import {
  ApiMetricsService,
  describeError,
  latencyBucketIndex,
  percentileFromHistogram,
} from './api-metrics.service';
import { featureFromRoute } from './route-feature';

describe('histograma de latência', () => {
  it('coloca a duração na faixa certa', () => {
    expect(latencyBucketIndex(0)).toBe(0);
    expect(latencyBucketIndex(50)).toBe(0);
    expect(latencyBucketIndex(51)).toBe(1);
    expect(latencyBucketIndex(5000)).toBe(6);
    expect(latencyBucketIndex(12000)).toBe(7);
  });

  it('p95 = limite da faixa que alcança 95%, nunca acima do máximo', () => {
    // 90 rápidas (≤50ms), 10 entre 500ms e 1s
    expect(percentileFromHistogram([90, 0, 0, 0, 10, 0, 0, 0], 800)).toBe(800);
    expect(percentileFromHistogram([90, 0, 0, 0, 10, 0, 0, 0], 2000)).toBe(1000);
    expect(percentileFromHistogram([100, 0, 0, 0, 0, 0, 0, 0], 12)).toBe(12);
    expect(percentileFromHistogram([0, 0, 0, 0, 0, 0, 0, 3], 9000)).toBe(9000);
    expect(percentileFromHistogram([0, 0, 0, 0, 0, 0, 0, 0], 0)).toBeNull();
  });
});

describe('describeError', () => {
  it('guarda tipo, código e só a 1ª linha da mensagem', () => {
    expect(describeError(new TypeError("Cannot read properties of undefined (reading 'id')\n    at x"))).toEqual({
      errorName: 'TypeError',
      message: "Cannot read properties of undefined (reading 'id')",
    });
    const prismaError = new Prisma.PrismaClientKnownRequestError(
      '\nInvalid `prisma.patient.create()` invocation in\n/app/x.ts:1:1\n\n  data: { name: "Maria Paciente" }\nServer has closed the connection.',
      { code: 'P1017', clientVersion: '5' },
    );
    const described = describeError(prismaError);
    expect(described.errorName).toBe('PrismaClientKnownRequestError (P1017)');
    expect(described.message).toBe(
      'Invalid `prisma.patient.create()` invocation in … Server has closed the connection.',
    );
    expect(described.message).not.toContain('Maria');
    expect(describeError(undefined)).toEqual({ errorName: null, message: null });
  });
});

describe('featureFromRoute', () => {
  it('liga a rota ao módulo do catálogo', () => {
    expect(featureFromRoute('/api/appointments/:id')).toBe('appointments');
    expect(featureFromRoute('/api/recurring-expenses')).toBe('recurring_expenses');
    expect(featureFromRoute('/api/skincare/routines')).toBe('routines');
    expect(featureFromRoute('/api/document-templates/:id')).toBe('documents');
    expect(featureFromRoute('/api/auth/me')).toBeNull();
    expect(featureFromRoute('/api/admin/usage')).toBeNull();
  });
});

describe('ApiMetricsService', () => {
  let prisma: any;
  let service: ApiMetricsService;

  beforeEach(() => {
    prisma = {
      $executeRaw: jest.fn().mockResolvedValue(1),
      apiRequestError: { createMany: jest.fn().mockResolvedValue({ count: 0 }), deleteMany: jest.fn() },
      apiRouteMetric: { deleteMany: jest.fn() },
    };
    service = new ApiMetricsService(prisma);
  });

  it('agrega por rota e clínica e grava só os 5xx como erro', async () => {
    const base = { method: 'GET', route: '/api/patients', tenantId: 't1' };
    service.record({ ...base, statusCode: 200, durationMs: 30 });
    service.record({ ...base, statusCode: 404, durationMs: 120 });
    service.record({ ...base, statusCode: 500, durationMs: 700, error: new Error('boom') });
    service.record({ ...base, tenantId: null, statusCode: 200, durationMs: 10 });

    await service.flush();

    // Uma linha por (hora, método, rota, clínica)
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(2);
    const values = prisma.$executeRaw.mock.calls[0].slice(1);
    // hour, method, route, tenantKey, count, clientErrors, serverErrors, totalMs, maxMs, histograma...
    expect(values.slice(1)).toEqual(['GET', '/api/patients', 't1', 3, 1, 1, 850, 700, 1, 0, 1, 0, 1, 0, 0, 0]);
    expect(prisma.$executeRaw.mock.calls[1][4]).toBe('');
    expect(prisma.apiRequestError.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          route: '/api/patients',
          statusCode: 500,
          durationMs: 700,
          errorName: 'Error',
          message: 'boom',
          targetTenantId: 't1',
        }),
      ],
    });
    // 1º flush também limpa o que passou da retenção
    expect(prisma.apiRouteMetric.deleteMany).toHaveBeenCalled();

    // Buffer zerado depois do flush
    prisma.$executeRaw.mockClear();
    await service.flush();
    expect(prisma.$executeRaw).not.toHaveBeenCalled();
  });

  it('falha ao gravar não propaga (métrica não derruba a API)', async () => {
    prisma.$executeRaw.mockRejectedValue(new Error('db down'));
    service.record({ method: 'GET', route: '/api/x', tenantId: null, statusCode: 200, durationMs: 1 });
    jest.spyOn((service as any).logger, 'error').mockImplementation(() => undefined);
    await expect(service.flush()).resolves.toBeUndefined();
  });
});
