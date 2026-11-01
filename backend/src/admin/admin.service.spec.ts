import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';

import { AdminService, currentBrazilMonthRange, slugify } from './admin.service';
import { TenantContext } from '../tenancy/tenant-context';
import { provisionTenant } from '../tenancy/system-roles';

jest.mock('../tenancy/system-roles', () => ({ provisionTenant: jest.fn() }));

describe('AdminService', () => {
  const actor = { id: 'root-1', name: 'Dono', email: 'root@platform.dev', isSuperAdmin: true } as any;
  const tenant = { id: 'tenant-1', name: 'Clínica Um', slug: 'clinica-um', active: true, suspendedAt: null };
  const plan = { id: '7f1c2a9e-4b1d-4c55-9a1e-3f0b6f1f2a10', name: 'Profissional', slug: 'profissional', active: true };

  let prisma: any;
  let auth: { signTenantAccess: jest.Mock };
  let service: AdminService;

  beforeEach(() => {
    prisma = {
      tenant: { findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
      user: { findUnique: jest.fn(), groupBy: jest.fn(), count: jest.fn(), aggregate: jest.fn(), findMany: jest.fn() },
      appointment: { groupBy: jest.fn(), count: jest.fn() },
      patient: { count: jest.fn() },
      document: { aggregate: jest.fn() },
      patientPhoto: { aggregate: jest.fn() },
      platformAuditLog: { create: jest.fn(), findMany: jest.fn(), count: jest.fn() },
      plan: { findUnique: jest.fn() },
    };
    auth = { signTenantAccess: jest.fn().mockResolvedValue('acting-token') };
    service = new AdminService(prisma, auth as any);
    (provisionTenant as jest.Mock).mockReset();
  });

  const lastAudit = () => prisma.platformAuditLog.create.mock.calls.at(-1)?.[0].data;

  describe('slugify', () => {
    it('remove acentos e símbolos', () => {
      expect(slugify('  Clínica Bela & Pele São José ')).toBe('clinica-bela-pele-sao-jose');
    });
  });

  describe('currentBrazilMonthRange', () => {
    it('usa o mês do Brasil, não o do UTC', () => {
      // 1º/nov 01:00 UTC ainda é 31/out no Brasil
      const range = currentBrazilMonthRange(new Date('2026-11-01T01:00:00Z'));
      expect(range.gte.toISOString()).toBe('2026-10-01T03:00:00.000Z');
      expect(range.lt.toISOString()).toBe('2026-11-01T03:00:00.000Z');
    });

    it('vira o ano em dezembro', () => {
      const range = currentBrazilMonthRange(new Date('2026-12-15T12:00:00Z'));
      expect(range.lt.toISOString()).toBe('2027-01-01T03:00:00.000Z');
    });
  });

  it('roda as consultas sem escopo de clínica', async () => {
    const spy = jest.spyOn(TenantContext, 'runUnscoped');
    prisma.tenant.findMany.mockResolvedValue([]);
    prisma.user.groupBy.mockResolvedValue([]);
    prisma.appointment.groupBy.mockResolvedValue([]);

    await service.listTenants({});

    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  describe('listTenants', () => {
    it('filtra por busca e status e junta as métricas por clínica', async () => {
      const lastAccessAt = new Date('2026-10-20T12:00:00Z');
      prisma.tenant.findMany.mockResolvedValue([{ ...tenant, _count: { users: 3, patients: 40 } }]);
      prisma.user.groupBy.mockResolvedValue([{ tenantId: 'tenant-1', _max: { lastAccessAt } }]);
      prisma.appointment.groupBy.mockResolvedValue([{ tenantId: 'tenant-1', _count: { _all: 12 } }]);

      const result = await service.listTenants({ search: ' bela ', status: 'suspended' });

      expect(prisma.tenant.findMany.mock.calls[0][0].where).toEqual({
        OR: [
          { name: { contains: 'bela', mode: 'insensitive' } },
          { slug: { contains: 'bela', mode: 'insensitive' } },
        ],
        active: false,
      });
      expect(result).toEqual([
        {
          ...tenant,
          specialties: [],
          metrics: { activeUsers: 3, patients: 40, appointmentsThisMonth: 12, lastAccessAt },
        },
      ]);
    });
  });

  describe('getTenant', () => {
    it('soma documentos e fotos no armazenamento', async () => {
      prisma.tenant.findUnique.mockResolvedValue(tenant);
      prisma.user.count.mockResolvedValueOnce(2).mockResolvedValueOnce(3);
      prisma.patient.count.mockResolvedValue(10);
      prisma.appointment.count.mockResolvedValue(5);
      prisma.user.aggregate.mockResolvedValue({ _max: { lastAccessAt: null } });
      prisma.document.aggregate.mockResolvedValue({ _sum: { size: 1000 }, _count: { _all: 2 } });
      prisma.patientPhoto.aggregate.mockResolvedValue({ _sum: { size: null }, _count: { _all: 0 } });
      prisma.user.findMany.mockResolvedValue([]);

      const result = await service.getTenant('tenant-1');

      expect(result.metrics).toEqual({
        activeUsers: 2,
        totalUsers: 3,
        patients: 10,
        appointmentsThisMonth: 5,
        lastAccessAt: null,
        storageBytes: 1000,
        files: 2,
      });
    });

    it('404 para clínica inexistente', async () => {
      prisma.tenant.findUnique.mockResolvedValue(null);
      await expect(service.getTenant('x')).rejects.toThrow(NotFoundException);
    });
  });

  describe('createTenant', () => {
    const dto = { name: 'Clínica Bela Pele', adminName: 'Ana', adminEmail: 'ana@belapele.com' };

    it('provisiona a clínica com o primeiro administrador e audita', async () => {
      prisma.tenant.findUnique.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue(null);
      (provisionTenant as jest.Mock).mockResolvedValue({ id: 'tenant-2', name: dto.name });

      await service.createTenant(dto, actor);

      expect(provisionTenant).toHaveBeenCalledWith(
        prisma,
        { name: dto.name, slug: 'clinica-bela-pele', planId: null },
        { name: 'Ana', email: 'ana@belapele.com', password: expect.any(String) },
      );
      expect(lastAudit()).toMatchObject({
        action: 'TENANT_CREATE',
        actorId: 'root-1',
        targetTenantId: 'tenant-2',
        details: { slug: 'clinica-bela-pele', adminEmail: 'ana@belapele.com' },
      });
    });

    it('atribui o plano escolhido e registra na auditoria', async () => {
      prisma.tenant.findUnique.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.plan.findUnique.mockResolvedValue(plan);
      (provisionTenant as jest.Mock).mockResolvedValue({ id: 'tenant-2', name: dto.name, planId: plan.id });

      const result = await service.createTenant({ ...dto, planId: plan.id }, actor);

      expect((provisionTenant as jest.Mock).mock.calls[0][1]).toEqual({
        name: dto.name,
        slug: 'clinica-bela-pele',
        planId: plan.id,
      });
      expect(lastAudit().details).toMatchObject({ plan: { id: plan.id, name: 'Profissional' } });
      expect(result.plan).toEqual(plan);
    });

    it('recusa plano desativado ou inexistente', async () => {
      prisma.tenant.findUnique.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.plan.findUnique.mockResolvedValue({ ...plan, active: false });
      await expect(service.createTenant({ ...dto, planId: plan.id }, actor)).rejects.toThrow(BadRequestException);
      prisma.plan.findUnique.mockResolvedValue(null);
      await expect(service.createTenant({ ...dto, planId: plan.id }, actor)).rejects.toThrow(NotFoundException);
      expect(provisionTenant).not.toHaveBeenCalled();
    });

    it('recusa identificador já usado', async () => {
      prisma.tenant.findUnique.mockResolvedValue(tenant);
      await expect(service.createTenant({ ...dto, slug: 'clinica-um' }, actor)).rejects.toThrow(ConflictException);
      expect(provisionTenant).not.toHaveBeenCalled();
    });

    it('recusa e-mail que já existe na plataforma', async () => {
      prisma.tenant.findUnique.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue({ id: 'u' });
      await expect(service.createTenant(dto, actor)).rejects.toThrow(ConflictException);
      expect(provisionTenant).not.toHaveBeenCalled();
    });

    it('recusa nome sem letras nem números quando não há identificador', async () => {
      await expect(service.createTenant({ ...dto, name: '***' }, actor)).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateTenant', () => {
    it('audita só os campos alterados', async () => {
      prisma.tenant.findUnique.mockResolvedValue(tenant);
      prisma.tenant.update.mockResolvedValue({ ...tenant, name: 'Clínica Nova' });

      await service.updateTenant('tenant-1', { name: 'Clínica Nova', slug: 'clinica-um' }, actor);

      expect(lastAudit()).toMatchObject({
        action: 'TENANT_UPDATE',
        targetName: 'Clínica Nova',
        details: { name: { old: 'Clínica Um', new: 'Clínica Nova' } },
      });
    });

    it('troca o plano e audita de/para', async () => {
      const essencial = { id: 'plan-1', name: 'Essencial' };
      prisma.tenant.findUnique.mockResolvedValue({ ...tenant, planId: essencial.id });
      prisma.plan.findUnique
        .mockResolvedValueOnce(plan) // plano novo (validação)
        .mockResolvedValueOnce(essencial); // plano antigo (auditoria)
      prisma.tenant.update.mockResolvedValue({ ...tenant, planId: plan.id, plan });

      const result = await service.updateTenant('tenant-1', { planId: plan.id }, actor);

      expect(prisma.tenant.update.mock.calls[0][0].data).toMatchObject({ planId: plan.id });
      expect(lastAudit()).toMatchObject({
        action: 'TENANT_PLAN_CHANGE',
        targetTenantId: 'tenant-1',
        details: { old: essencial, new: { id: plan.id, name: 'Profissional' } },
      });
      expect(prisma.platformAuditLog.create).toHaveBeenCalledTimes(1);
      expect(result.plan).toEqual(plan);
    });

    it('null remove o plano', async () => {
      prisma.tenant.findUnique.mockResolvedValue({ ...tenant, planId: plan.id });
      prisma.plan.findUnique.mockResolvedValue({ id: plan.id, name: plan.name });
      prisma.tenant.update.mockResolvedValue({ ...tenant, planId: null, plan: null });

      await service.updateTenant('tenant-1', { planId: null }, actor);

      expect(prisma.tenant.update.mock.calls[0][0].data).toMatchObject({ planId: null });
      expect(lastAudit()).toMatchObject({ action: 'TENANT_PLAN_CHANGE', details: { new: null } });
    });

    it('mesmo plano não troca nem audita (vale para plano já desativado)', async () => {
      prisma.tenant.findUnique.mockResolvedValue({ ...tenant, planId: plan.id });
      prisma.tenant.update.mockResolvedValue({ ...tenant, planId: plan.id });

      await service.updateTenant('tenant-1', { planId: plan.id }, actor);

      expect(prisma.plan.findUnique).not.toHaveBeenCalled();
      expect(prisma.tenant.update.mock.calls[0][0].data).not.toHaveProperty('planId');
      expect(prisma.platformAuditLog.create).not.toHaveBeenCalled();
    });

    it('não audita quando nada mudou', async () => {
      prisma.tenant.findUnique.mockResolvedValue(tenant);
      prisma.tenant.update.mockResolvedValue(tenant);
      await service.updateTenant('tenant-1', { name: 'Clínica Um' }, actor);
      expect(prisma.platformAuditLog.create).not.toHaveBeenCalled();
    });

    it('salva overrides de módulos e audita TENANT_FEATURES_CHANGE', async () => {
      const withPlan = {
        ...tenant,
        planId: plan.id,
        plan: { ...plan, features: ['patients', 'finance'] },
        featuresExtra: null,
        featuresDenied: null,
      };
      prisma.tenant.findUnique.mockResolvedValue(withPlan);
      prisma.tenant.update.mockResolvedValue({
        ...withPlan,
        featuresExtra: ['messages'],
        featuresDenied: ['finance'],
        plan: withPlan.plan,
      });

      const result = await service.updateTenant(
        'tenant-1',
        { featuresExtra: ['messages'], featuresDenied: ['finance'] },
        actor,
      );

      expect(prisma.tenant.update.mock.calls[0][0].data).toMatchObject({
        featuresExtra: ['messages'],
        featuresDenied: ['finance'],
      });
      expect(lastAudit()).toMatchObject({
        action: 'TENANT_FEATURES_CHANGE',
        details: {
          old: { featuresExtra: [], featuresDenied: [] },
          new: { featuresExtra: ['messages'], featuresDenied: ['finance'] },
          effectiveFeatures: ['patients', 'messages'],
        },
      });
      expect(result.effectiveFeatures).toEqual(['patients', 'messages']);
    });
  });

  describe('suspender e reativar', () => {
    it('suspende com data e motivo na auditoria', async () => {
      prisma.tenant.findUnique.mockResolvedValue(tenant);
      prisma.tenant.update.mockResolvedValue({ ...tenant, active: false });

      await service.suspendTenant('tenant-1', 'Inadimplência', actor);

      expect(prisma.tenant.update).toHaveBeenCalledWith({
        where: { id: 'tenant-1' },
        data: { active: false, suspendedAt: expect.any(Date) },
      });
      expect(lastAudit()).toMatchObject({ action: 'TENANT_SUSPEND', details: { reason: 'Inadimplência' } });
    });

    it('suspender clínica já suspensa não faz nada', async () => {
      prisma.tenant.findUnique.mockResolvedValue({ ...tenant, active: false });
      await service.suspendTenant('tenant-1', undefined, actor);
      expect(prisma.tenant.update).not.toHaveBeenCalled();
      expect(prisma.platformAuditLog.create).not.toHaveBeenCalled();
    });

    it('reativa limpando suspendedAt', async () => {
      prisma.tenant.findUnique.mockResolvedValue({ ...tenant, active: false });
      prisma.tenant.update.mockResolvedValue(tenant);

      await service.reactivateTenant('tenant-1', actor);

      expect(prisma.tenant.update).toHaveBeenCalledWith({
        where: { id: 'tenant-1' },
        data: { active: true, suspendedAt: null },
      });
      expect(lastAudit()).toMatchObject({ action: 'TENANT_REACTIVATE' });
    });
  });

  describe('enterTenant', () => {
    it('devolve o token e sempre registra na auditoria', async () => {
      prisma.tenant.findUnique.mockResolvedValue(tenant);

      const result = await service.enterTenant('tenant-1', actor);

      expect(auth.signTenantAccess).toHaveBeenCalledWith(actor, 'tenant-1');
      expect(result).toEqual({ access_token: 'acting-token', tenant: { id: 'tenant-1', name: 'Clínica Um' } });
      expect(lastAudit()).toMatchObject({
        action: 'TENANT_ENTER',
        actorId: 'root-1',
        actorEmail: 'root@platform.dev',
        targetTenantId: 'tenant-1',
      });
    });

    it('404 sem emitir token para clínica inexistente', async () => {
      prisma.tenant.findUnique.mockResolvedValue(null);
      await expect(service.enterTenant('x', actor)).rejects.toThrow(NotFoundException);
      expect(auth.signTenantAccess).not.toHaveBeenCalled();
    });
  });

  describe('listAudit', () => {
    it('pagina e filtra por clínica', async () => {
      prisma.platformAuditLog.findMany.mockResolvedValue([]);
      prisma.platformAuditLog.count.mockResolvedValue(120);

      const result = await service.listAudit({ tenantId: 'tenant-1', page: 2, limit: 500 });

      expect(prisma.platformAuditLog.findMany).toHaveBeenCalledWith({
        where: { targetTenantId: 'tenant-1' },
        orderBy: { createdAt: 'desc' },
        skip: 100,
        take: 100,
      });
      expect(result).toMatchObject({ total: 120, page: 2, limit: 100, totalPages: 2 });
    });
  });
});
