import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

import { SuperAdminsService } from './super-admins.service';

jest.mock('bcrypt', () => ({ hash: jest.fn().mockResolvedValue('hashed') }));

describe('SuperAdminsService', () => {
  const actor = { id: 'root-1', name: 'Dono', email: 'root@platform.dev', isSuperAdmin: true } as any;
  const pure = {
    id: 'sa-pure',
    name: 'Root',
    email: 'root@platform.dev',
    tenantId: null,
    roleId: null,
    isSuperAdmin: true,
    active: true,
    createdAt: new Date('2026-01-01'),
    lastAccessAt: null,
    tokenVersion: 0,
  };
  const dual = {
    id: 'sa-dual',
    name: 'Ana',
    email: 'ana@clinic.dev',
    tenantId: 't1',
    roleId: 'r1',
    isSuperAdmin: true,
    active: true,
    createdAt: new Date('2026-02-01'),
    lastAccessAt: new Date('2026-10-01'),
    tokenVersion: 1,
  };
  const clinicUser = {
    id: 'u-clinic',
    name: 'Bruno',
    email: 'bruno@clinic.dev',
    tenantId: 't1',
    roleId: 'r1',
    isSuperAdmin: false,
    active: true,
    createdAt: new Date('2026-03-01'),
    lastAccessAt: null,
    tokenVersion: 0,
  };

  let prisma: any;
  let service: SuperAdminsService;

  beforeEach(() => {
    prisma = {
      user: {
        findMany: jest.fn().mockResolvedValue([
          { ...pure, tenant: null },
          { ...dual, tenant: { id: 't1', name: 'Clínica A', slug: 'clinica-a' } },
        ]),
        findUnique: jest.fn(),
        create: jest.fn(({ data }) => Promise.resolve({ id: 'sa-new', ...data, createdAt: new Date(), lastAccessAt: null, tokenVersion: 0, active: true })),
        update: jest.fn(({ where, data }) => {
          const base = [pure, dual, clinicUser].find((u) => u.id === where.id || u.email === where.email) ?? pure;
          const next = { ...base, ...data };
          if (data?.tokenVersion?.increment) next.tokenVersion = (base.tokenVersion ?? 0) + data.tokenVersion.increment;
          return Promise.resolve(next);
        }),
        delete: jest.fn(),
        count: jest.fn().mockResolvedValue(1),
      },
      appointment: { count: jest.fn().mockResolvedValue(0) },
      platformAuditLog: { create: jest.fn() },
    };
    service = new SuperAdminsService(prisma);
  });

  const lastAudit = () => prisma.platformAuditLog.create.mock.calls.at(-1)?.[0].data;

  it('lista com flag de clínica (login dual)', async () => {
    const list = await service.list();
    expect(list).toEqual([
      expect.objectContaining({ id: 'sa-pure', hasClinic: false, tenantName: null }),
      expect.objectContaining({
        id: 'sa-dual',
        hasClinic: true,
        tenantName: 'Clínica A',
        tenantSlug: 'clinica-a',
      }),
    ]);
  });

  it('cria super-admin puro e audita SUPER_ADMIN_CREATE', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.findMany.mockResolvedValue([
      {
        id: 'sa-new',
        name: 'Novo',
        email: 'novo@platform.dev',
        tenantId: null,
        active: true,
        createdAt: new Date(),
        lastAccessAt: null,
        tenant: null,
      },
    ]);

    const created = await service.create({ email: 'Novo@Platform.dev', name: 'Novo' }, actor);
    expect(bcrypt.hash).toHaveBeenCalled();
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: 'novo@platform.dev',
          isSuperAdmin: true,
          tenantId: null,
          roleId: null,
        }),
      }),
    );
    expect(created.email).toBe('novo@platform.dev');
    expect(lastAudit()).toMatchObject({
      action: 'SUPER_ADMIN_CREATE',
      targetTenantId: null,
      details: expect.objectContaining({ dual: false }),
    });
  });

  it('promove usuário de clínica (dual) e audita SUPER_ADMIN_PROMOTE', async () => {
    prisma.user.findUnique.mockResolvedValue(clinicUser);
    prisma.user.findMany.mockResolvedValue([
      {
        ...clinicUser,
        isSuperAdmin: true,
        tenant: { id: 't1', name: 'Clínica A', slug: 'clinica-a' },
      },
    ]);

    const promoted = await service.create({ email: 'bruno@clinic.dev', name: 'Bruno Admin' }, actor);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { email: 'bruno@clinic.dev' },
      data: { isSuperAdmin: true, name: 'Bruno Admin' },
    });
    expect(promoted.hasClinic).toBe(true);
    expect(lastAudit().action).toBe('SUPER_ADMIN_PROMOTE');
  });

  it('recusa e-mail que já é super-admin', async () => {
    prisma.user.findUnique.mockResolvedValue(pure);
    await expect(service.create({ email: 'root@platform.dev', name: 'Root' }, actor)).rejects.toThrow(
      ConflictException,
    );
    expect(prisma.platformAuditLog.create).not.toHaveBeenCalled();
  });

  it('não permite remover a si mesmo', async () => {
    prisma.user.findUnique.mockResolvedValue({ ...pure, id: actor.id });
    await expect(service.remove(actor.id, actor)).rejects.toThrow(BadRequestException);
  });

  it('não permite remover o último super-admin', async () => {
    prisma.user.findUnique.mockResolvedValue(dual);
    prisma.user.count.mockResolvedValue(0);
    await expect(service.remove(dual.id, actor)).rejects.toThrow(BadRequestException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('dual: só tira isSuperAdmin e incrementa tokenVersion', async () => {
    prisma.user.findUnique.mockResolvedValue(dual);
    prisma.user.count.mockResolvedValue(1);
    const res = await service.remove(dual.id, actor);
    expect(res).toEqual({ ok: true, outcome: 'demoted' });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: dual.id },
      data: { isSuperAdmin: false, tokenVersion: { increment: 1 } },
    });
    expect(prisma.user.delete).not.toHaveBeenCalled();
    expect(lastAudit()).toMatchObject({ action: 'SUPER_ADMIN_DEMOTE', details: { outcome: 'demoted', dual: true } });
  });

  it('puro sem agendamentos: exclui e audita SUPER_ADMIN_DELETE', async () => {
    prisma.user.findUnique.mockResolvedValue(pure);
    prisma.user.count.mockResolvedValue(1);
    prisma.appointment.count.mockResolvedValue(0);
    const res = await service.remove(pure.id, actor);
    expect(res.outcome).toBe('deleted');
    expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: pure.id } });
    expect(lastAudit().action).toBe('SUPER_ADMIN_DELETE');
  });

  it('puro com agendamentos: desativa e tira isSuperAdmin', async () => {
    prisma.user.findUnique.mockResolvedValue(pure);
    prisma.user.count.mockResolvedValue(1);
    prisma.appointment.count.mockResolvedValue(2);
    const res = await service.remove(pure.id, actor);
    expect(res.outcome).toBe('deactivated');
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: pure.id },
      data: { active: false, isSuperAdmin: false, tokenVersion: { increment: 1 } },
    });
    expect(lastAudit().action).toBe('SUPER_ADMIN_DEACTIVATE');
  });

  it('404 se o alvo não é super-admin', async () => {
    prisma.user.findUnique.mockResolvedValue(clinicUser);
    await expect(service.remove(clinicUser.id, actor)).rejects.toThrow(NotFoundException);
  });
});
