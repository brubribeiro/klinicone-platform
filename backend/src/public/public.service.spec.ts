import { PublicService } from './public.service';

describe('PublicService', () => {
  let prisma: any;
  let service: PublicService;

  beforeEach(() => {
    prisma = { plan: { findMany: jest.fn() } };
    service = new PublicService(prisma);
  });

  it('lista só planos ativos, sem id nem dados internos', async () => {
    prisma.plan.findMany.mockResolvedValue([]);

    await service.listPlans();

    const args = prisma.plan.findMany.mock.calls[0][0];
    expect(args.where).toEqual({ active: true });
    expect(Object.keys(args.select).sort()).toEqual(
      ['currency', 'description', 'features', 'limits', 'name', 'priceCents', 'slug'],
    );
  });

  it('normaliza módulos e limites', async () => {
    prisma.plan.findMany.mockResolvedValue([
      {
        name: 'Essencial',
        slug: 'essencial',
        description: null,
        priceCents: 9700,
        currency: 'BRL',
        features: ['patients', 'patients', 'nao-existe', 'appointments'],
        limits: { maxUsers: 3, foo: 1 },
      },
      { name: 'Enterprise', slug: 'enterprise', description: null, priceCents: null, currency: 'BRL', features: null, limits: null },
    ]);

    const [essencial, enterprise] = await service.listPlans();

    expect(essencial.features).toEqual(['appointments', 'patients']);
    expect(essencial.limits).toEqual({ maxUsers: 3 });
    expect(enterprise.features).toEqual([]);
    expect(enterprise.limits).toBeNull();
  });
});
