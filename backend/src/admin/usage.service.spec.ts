import { BadRequestException, NotFoundException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';

import { MODULE_USAGE_SOURCES, UsageService, parseUsageRange } from './usage.service';
import { PlatformInsightsController } from './platform-insights.controller';
import { SuperAdminGuard } from '../tenancy/super-admin.guard';
import { TenantContext } from '../tenancy/tenant-context';

describe('parseUsageRange', () => {
  // 1º/nov 01:00 UTC ainda é 31/out no Brasil
  const now = new Date('2026-11-01T01:00:00Z');

  it('padrão = mês corrente do Brasil', () => {
    const range = parseUsageRange(undefined, undefined, now);
    expect(range).toMatchObject({ from: '2026-10-01', to: '2026-10-31' });
    expect(range.gte.toISOString()).toBe('2026-10-01T03:00:00.000Z');
    expect(range.lt.toISOString()).toBe('2026-11-01T03:00:00.000Z');
  });

  it('só "from" vai até hoje; "to" é inclusivo', () => {
    const range = parseUsageRange('2026-09-15', undefined, now);
    expect(range.to).toBe('2026-10-31');
    expect(parseUsageRange('2026-02-01', '2026-02-28', now).lt.toISOString()).toBe('2026-03-01T03:00:00.000Z');
  });

  it('recusa data inválida ou invertida', () => {
    expect(() => parseUsageRange('2026-13-01', '2026-12-31', now)).toThrow(BadRequestException);
    expect(() => parseUsageRange('01/10/2026', undefined, now)).toThrow(BadRequestException);
    expect(() => parseUsageRange('2026-10-10', '2026-10-01', now)).toThrow(BadRequestException);
  });
});

describe('UsageService', () => {
  const tenants = [
    {
      id: 't1',
      name: 'Clínica Um',
      slug: 'clinica-um',
      active: true,
      planId: 'p1',
      featuresExtra: null,
      featuresDenied: ['inventory'],
      plan: { id: 'p1', name: 'Básico', features: ['appointments', 'patients', 'inventory'] },
    },
    {
      id: 't2',
      name: 'Clínica Dois',
      slug: 'clinica-dois',
      active: false,
      planId: null,
      featuresExtra: null,
      featuresDenied: null,
      plan: null,
    },
  ];

  let prisma: any;
  let service: UsageService;

  const rows = (counts: Record<string, number>) =>
    Object.entries(counts).map(([tenantId, n]) => ({ tenantId, _count: { _all: n } }));

  beforeEach(() => {
    prisma = {
      tenant: { findMany: jest.fn().mockResolvedValue(tenants) },
      user: { groupBy: jest.fn() },
      document: { groupBy: jest.fn().mockResolvedValue([{ tenantId: 't1', _sum: { size: 1000 }, _count: { _all: 2 } }]) },
      patientPhoto: {
        groupBy: jest.fn().mockResolvedValue([{ tenantId: 't1', _sum: { size: null }, _count: { _all: 1 } }]),
      },
      apiRouteMetric: {
        groupBy: jest.fn().mockResolvedValue([
          { route: '/api/metrics/summary', _sum: { count: 7 } },
          { route: '/api/skincare/routines/:id', _sum: { count: 2 } },
          { route: '/api/auth/me', _sum: { count: 9 } },
        ]),
      },
    };
    for (const source of Object.values(MODULE_USAGE_SOURCES)) {
      if (source && !prisma[source.model]) prisma[source.model] = { groupBy: jest.fn().mockResolvedValue([]) };
    }
    // Agenda: período tem filtro de data, total não
    prisma.appointment.groupBy.mockImplementation(({ where }: any) =>
      Promise.resolve(where.startAt ? rows({ t1: 4 }) : rows({ t1: 10, t2: 3 })),
    );
    prisma.user.groupBy.mockImplementation(({ where, _max }: any) => {
      if (_max) return Promise.resolve([{ tenantId: 't1', _max: { lastAccessAt: new Date('2026-10-20T12:00:00Z') } }]);
      if (where.lastAccessAt) return Promise.resolve(rows({ t1: 1 }));
      return Promise.resolve(rows({ t1: 2, t2: 1 }));
    });
    service = new UsageService(prisma);
  });

  it('agrega uso por módulo e por clínica, sem escopo de clínica', async () => {
    const spy = jest.spyOn(TenantContext, 'runUnscoped');

    const result = await service.getUsage({ from: '2026-10-01', to: '2026-10-31' });

    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
    expect(prisma.appointment.groupBy).toHaveBeenCalledWith({
      by: ['tenantId'],
      where: { startAt: { gte: new Date('2026-10-01T03:00:00Z'), lt: new Date('2026-11-01T03:00:00Z') } },
      _count: { _all: true },
    });
    expect(result.range).toEqual({ from: '2026-10-01', to: '2026-10-31' });

    const appointments = result.modules.find((m) => m.key === 'appointments')!;
    // t2 sem plano = todos os módulos
    expect(appointments).toMatchObject({ enabledTenants: 2, activeTenants: 1, periodCount: 4, totalCount: 13 });
    const inventory = result.modules.find((m) => m.key === 'inventory')!;
    expect(inventory.enabledTenants).toBe(1); // negado em t1
    const metrics = result.modules.find((m) => m.key === 'metrics')!;
    expect(metrics).toMatchObject({ metricLabel: null, periodCount: null, totalCount: null, activeTenants: null });
    // Requisições à API por módulo (rotas da plataforma, como /auth, ficam de fora)
    expect(metrics.requests).toBe(7);
    expect(result.modules.find((m) => m.key === 'routines')!.requests).toBe(2);
    expect(appointments.requests).toBe(0);

    const [t1, t2] = result.tenants;
    expect(t1).toMatchObject({
      id: 't1',
      plan: { id: 'p1', name: 'Básico' },
      features: ['appointments', 'patients'],
      activeUsers: 2,
      usersAccessedInPeriod: 1,
      storageBytes: 1000,
      files: 3,
    });
    expect(t1.usage.appointments).toEqual({ period: 4, total: 10 });
    expect(t1.usage.metrics).toBeNull();
    expect(t2).toMatchObject({ lastAccessAt: null, storageBytes: 0, files: 0 });
    expect(t2.usage.appointments).toEqual({ period: 0, total: 3 });
    expect(result.totals).toEqual({
      tenants: 2,
      activeTenants: 1,
      activeUsers: 3,
      usersAccessedInPeriod: 1,
      storageBytes: 1000,
      files: 3,
    });
  });

  it('filtra por clínica em todas as consultas', async () => {
    prisma.tenant.findMany.mockResolvedValue([tenants[0]]);

    await service.getUsage({ tenantId: 't1' });

    expect(prisma.tenant.findMany.mock.calls[0][0].where).toEqual({ id: 't1' });
    for (const call of prisma.appointment.groupBy.mock.calls) expect(call[0].where.tenantId).toBe('t1');
    for (const call of prisma.document.groupBy.mock.calls) expect(call[0].where.tenantId).toBe('t1');
    expect(prisma.apiRouteMetric.groupBy.mock.calls[0][0].where.tenantKey).toBe('t1');
    expect(prisma.patientPhoto.groupBy.mock.calls[0][0].where).toEqual({ tenantId: 't1' });
  });

  it('404 se a clínica não existe', async () => {
    prisma.tenant.findMany.mockResolvedValue([]);
    await expect(service.getUsage({ tenantId: 'nope' })).rejects.toThrow(NotFoundException);
  });

  it('só devolve contagens: nenhum select de dado clínico', async () => {
    await service.getUsage({});
    for (const source of Object.values(MODULE_USAGE_SOURCES)) {
      if (!source) continue;
      for (const [args] of prisma[source.model].groupBy.mock.calls) {
        expect(args).not.toHaveProperty('select');
        expect(args).not.toHaveProperty('include');
        expect(args.by).toEqual(['tenantId']);
      }
    }
  });
});

describe('PlatformInsightsController', () => {
  it('fica atrás do SuperAdminGuard', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, PlatformInsightsController);
    expect(guards).toContain(SuperAdminGuard);
  });
});
