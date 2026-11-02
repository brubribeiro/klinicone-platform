import { NotFoundException } from '@nestjs/common';

import { TenantPlanService } from './tenant-plan.service';

describe('TenantPlanService', () => {
  const prisma = {
    tenant: { findUnique: jest.fn() },
    user: { count: jest.fn() },
    patient: { count: jest.fn() },
    document: { aggregate: jest.fn() },
    patientPhoto: { aggregate: jest.fn() },
  };

  let service: TenantPlanService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TenantPlanService(prisma as never);
  });

  it('returns plan, usage and effective features', async () => {
    prisma.tenant.findUnique.mockResolvedValue({
      id: 't1',
      planId: 'p1',
      featuresExtra: null,
      featuresDenied: null,
      plan: {
        id: 'p1',
        name: 'Essencial',
        slug: 'essencial',
        description: null,
        priceCents: 9900,
        currency: 'BRL',
        limits: { maxUsers: 5, maxPatients: 500, storageGb: 2 },
        features: ['patients', 'appointments'],
      },
    });
    prisma.user.count.mockResolvedValue(3);
    prisma.patient.count.mockResolvedValue(120);
    prisma.document.aggregate.mockResolvedValue({ _sum: { size: 1000 }, _count: { _all: 2 } });
    prisma.patientPhoto.aggregate.mockResolvedValue({ _sum: { size: 500 }, _count: { _all: 1 } });

    const result = await service.getSummary('t1');

    expect(result.plan?.name).toBe('Essencial');
    expect(result.plan?.limits).toEqual({ maxUsers: 5, maxPatients: 500, storageGb: 2 });
    expect(result.usage).toEqual({ activeUsers: 3, patients: 120, storageBytes: 1500, files: 3 });
    expect(result.features).toContain('patients');
  });

  it('throws when tenant is missing', async () => {
    prisma.tenant.findUnique.mockResolvedValue(null);
    await expect(service.getSummary('nope')).rejects.toThrow(NotFoundException);
  });
});
