import { ObservabilityService } from './observability.service';

const hist = (h: number[]) => {
  const [le50, le100, le250, le500, le1000, le2500, le5000, gt5000] = h;
  return { le50, le100, le250, le500, le1000, le2500, le5000, gt5000 };
};

describe('ObservabilityService', () => {
  let prisma: any;
  let service: ObservabilityService;

  beforeEach(() => {
    prisma = {
      apiRouteMetric: {
        groupBy: jest.fn().mockResolvedValue([
          {
            method: 'GET',
            route: '/api/patients',
            _sum: { count: 100, clientErrors: 2, serverErrors: 0, totalMs: 3000, ...hist([98, 2, 0, 0, 0, 0, 0, 0]) },
            _max: { maxMs: 90 },
          },
          {
            method: 'GET',
            route: '/api/metrics/summary',
            _sum: { count: 20, clientErrors: 0, serverErrors: 5, totalMs: 40000, ...hist([0, 0, 0, 0, 10, 8, 2, 0]) },
            _max: { maxMs: 4200 },
          },
        ]),
      },
      apiRequestError: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'e1', route: '/api/metrics/summary', targetTenant: { id: 't1', name: 'Clínica Um' } },
        ]),
      },
    };
    service = new ObservabilityService(prisma);
  });

  it('janela começa no início da hora e inclui a hora corrente', async () => {
    const result = await service.getOverview({ hours: 24 }, new Date('2026-10-30T15:42:00Z'));
    expect(result.window).toEqual({ hours: 24, since: '2026-10-29T16:00:00.000Z' });
    expect(prisma.apiRouteMetric.groupBy.mock.calls[0][0].where).toEqual({
      hour: { gte: new Date('2026-10-29T16:00:00Z') },
    });
  });

  it('ordena rotas lentas pelo p95 e as com erro pela quantidade de 5xx', async () => {
    const result = await service.getOverview({});

    expect(result.totals).toMatchObject({ count: 120, serverErrors: 5, clientErrors: 2, routes: 2, maxMs: 4200 });
    expect(result.totals.p95Ms).toBe(2500);
    expect(result.slowRoutes.map((r) => r.route)).toEqual(['/api/metrics/summary', '/api/patients']);
    expect(result.slowRoutes[0]).toMatchObject({ avgMs: 2000, p95Ms: 4200, maxMs: 4200, errorRate: 0.25 });
    expect(result.slowRoutes[1]).toMatchObject({ avgMs: 30, p95Ms: 50 });
    expect(result.errorRoutes.map((r) => r.route)).toEqual(['/api/metrics/summary']);
    expect(result.recentErrors[0]).toEqual({
      id: 'e1',
      route: '/api/metrics/summary',
      tenant: { id: 't1', name: 'Clínica Um' },
    });
  });
});
