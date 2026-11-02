import { ForbiddenException } from '@nestjs/common';

import { PlanLimitsService, resolvePlanLimits } from './plan-limits.service';
import { TenantContext } from '../tenancy/tenant-context';

const GB = 1024 ** 3;

describe('resolvePlanLimits', () => {
  it('sem plano ou sem limites = ilimitado', () => {
    const unlimited = { maxUsers: null, maxPatients: null, storageGb: null };
    expect(resolvePlanLimits(null)).toEqual(unlimited);
    expect(resolvePlanLimits({ limits: null })).toEqual(unlimited);
  });

  it('lê só limites numéricos positivos', () => {
    expect(resolvePlanLimits({ limits: { maxUsers: 3, maxPatients: 'x', storageGb: 0.5 } })).toEqual({
      maxUsers: 3,
      maxPatients: null,
      storageGb: 0.5,
    });
  });
});

describe('PlanLimitsService', () => {
  let prisma: any;
  let service: PlanLimitsService;

  const withPlan = (limits: unknown) =>
    prisma.tenant.findUnique.mockResolvedValue({ plan: { limits } });

  const inTenant = <T>(fn: () => Promise<T>) => TenantContext.run('tenant-1', fn);

  beforeEach(() => {
    prisma = {
      tenant: { findUnique: jest.fn().mockResolvedValue({ plan: null }) },
      user: { count: jest.fn().mockResolvedValue(0) },
      patient: { count: jest.fn().mockResolvedValue(0) },
      document: { aggregate: jest.fn().mockResolvedValue({ _sum: { size: 0 } }) },
      patientPhoto: { aggregate: jest.fn().mockResolvedValue({ _sum: { size: 0 } }) },
    };
    service = new PlanLimitsService(prisma);
  });

  it('clínica sem plano não bloqueia nem conta (legado)', async () => {
    await inTenant(async () => {
      await service.assertCanAddUser();
      await service.assertCanAddPatient();
      await service.assertStorageAvailable(100 * GB);
    });
    expect(prisma.user.count).not.toHaveBeenCalled();
    expect(prisma.patient.count).not.toHaveBeenCalled();
    expect(prisma.document.aggregate).not.toHaveBeenCalled();
  });

  it('bloqueia usuário ativo além do limite', async () => {
    withPlan({ maxUsers: 2 });
    prisma.user.count.mockResolvedValue(1);
    await expect(inTenant(() => service.assertCanAddUser())).resolves.toBeUndefined();

    prisma.user.count.mockResolvedValue(2);
    await expect(inTenant(() => service.assertCanAddUser())).rejects.toThrow(
      new ForbiddenException(
        'Limite do plano atingido: até 2 usuário(s) ativo(s). Desative um usuário ou fale com o suporte para ampliar o plano.',
      ),
    );
    expect(prisma.user.count).toHaveBeenCalledWith({ where: { active: true } });
  });

  it('bloqueia paciente além do limite', async () => {
    withPlan({ maxPatients: 10 });
    prisma.patient.count.mockResolvedValue(10);
    await expect(inTenant(() => service.assertCanAddPatient())).rejects.toThrow(/até 10 paciente\(s\)/);
  });

  it('bloqueia upload que passaria do armazenamento', async () => {
    withPlan({ storageGb: 1 });
    prisma.document.aggregate.mockResolvedValue({ _sum: { size: 0.5 * GB } });
    prisma.patientPhoto.aggregate.mockResolvedValue({ _sum: { size: 0.4 * GB } });

    await expect(inTenant(() => service.assertStorageAvailable(0.1 * GB))).resolves.toBeUndefined();
    await expect(inTenant(() => service.assertStorageAvailable(0.2 * GB))).rejects.toThrow(
      /Limite de armazenamento do plano atingido: 922 MB de 1 GB usados/,
    );
    // Substituir um arquivo libera o espaço dele
    await expect(inTenant(() => service.assertStorageAvailable(0.2 * GB, 0.1 * GB))).resolves.toBeUndefined();
  });

  it('exige contexto de clínica', async () => {
    await expect(service.assertCanAddPatient()).rejects.toThrow(ForbiddenException);
  });
});
