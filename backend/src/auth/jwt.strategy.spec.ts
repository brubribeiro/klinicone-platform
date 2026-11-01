import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { JwtStrategy } from './jwt.strategy';
import { ALL_PERMISSIONS } from '../common/permissions';
import { PLATFORM_FEATURES } from '../common/platform-features';

describe('JwtStrategy', () => {
  const superAdmin = {
    id: 'root-1',
    name: 'Dono',
    email: 'root@platform.dev',
    tenantId: null,
    tenant: null,
    isSuperAdmin: true,
    active: true,
    roleId: null,
    role: null,
    providesAppointments: false,
    lastAccessAt: null,
    tokenVersion: 0,
  };
  const clinicUser = {
    ...superAdmin,
    id: 'user-1',
    email: 'ana@clinica.com',
    tenantId: 'tenant-1',
    tenant: {
      id: 'tenant-1',
      name: 'Clínica Um',
      active: true,
      planId: null,
      featuresExtra: null,
      featuresDenied: null,
      plan: null,
    },
    isSuperAdmin: false,
    roleId: 'role-1',
    role: { name: 'Recepção', permissions: ['patients:view'], restrictToOwnAppointments: false },
    lastAccessAt: new Date(),
    tokenVersion: 2,
  };

  let prisma: { user: { findUnique: jest.Mock; update: jest.Mock }; tenant: { findUnique: jest.Mock } };
  let strategy: JwtStrategy;

  beforeEach(() => {
    prisma = {
      user: { findUnique: jest.fn(), update: jest.fn().mockResolvedValue({}) },
      tenant: { findUnique: jest.fn() },
    };
    const config = { get: () => 'secret' } as unknown as ConfigService;
    strategy = new JwtStrategy(config, prisma as any);
  });

  describe('super-admin "entrando como" clínica', () => {
    it('age como administrador da clínica alvo, com o nome dela', async () => {
      prisma.user.findUnique.mockResolvedValue(superAdmin);
      prisma.tenant.findUnique.mockResolvedValue({
        id: 'tenant-2',
        name: 'Clínica Dois',
        active: true,
        planId: 'plan-1',
        featuresExtra: ['messages'],
        featuresDenied: ['finance'],
        plan: { features: ['patients', 'finance', 'appointments'] },
      });

      const user = await strategy.validate({
        sub: 'root-1',
        email: superAdmin.email,
        tenantId: 'tenant-2',
        tv: 0,
        impersonatorId: 'root-1',
      });

      expect(user).toMatchObject({
        id: 'root-1',
        tenantId: 'tenant-2',
        tenantName: 'Clínica Dois',
        isSuperAdmin: true,
        roleName: 'Administrador',
        impersonatorId: 'root-1',
        features: ['appointments', 'patients', 'messages'],
      });
      expect(user.permissions).toEqual(ALL_PERMISSIONS);
    });

    it('vale também para clínica suspensa (suporte)', async () => {
      prisma.user.findUnique.mockResolvedValue(superAdmin);
      prisma.tenant.findUnique.mockResolvedValue({
        id: 'tenant-2',
        name: 'Clínica Dois',
        active: false,
        planId: null,
        plan: null,
      });

      await expect(
        strategy.validate({
          sub: 'root-1',
          email: superAdmin.email,
          tenantId: 'tenant-2',
          tv: 0,
          impersonatorId: 'root-1',
        }),
      ).resolves.toMatchObject({ tenantId: 'tenant-2' });
    });

    it('recusa clínica inexistente', async () => {
      prisma.user.findUnique.mockResolvedValue(superAdmin);
      prisma.tenant.findUnique.mockResolvedValue(null);

      await expect(
        strategy.validate({
          sub: 'root-1',
          email: superAdmin.email,
          tenantId: 'x',
          tv: 0,
          impersonatorId: 'root-1',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('recusa token com tenant de usuário que não é super-admin', async () => {
      prisma.user.findUnique.mockResolvedValue(clinicUser);

      await expect(
        strategy.validate({
          sub: 'user-1',
          email: clinicUser.email,
          tenantId: 'tenant-2',
          tv: 2,
          impersonatorId: 'user-1',
        }),
      ).rejects.toThrow(UnauthorizedException);
      expect(prisma.tenant.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('super-admin dual', () => {
    const dualUser = {
      ...clinicUser,
      isSuperAdmin: true,
    };

    it('token pendente expõe panelSelectionPending', async () => {
      prisma.user.findUnique.mockResolvedValue(dualUser);

      const user = await strategy.validate({
        sub: 'user-1',
        email: dualUser.email,
        tenantId: null,
        panelSelectionPending: true,
        tv: dualUser.tokenVersion,
      });

      expect(user).toMatchObject({ panelSelectionPending: true, canChoosePanel: true, tenantId: null });
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('modo plataforma aceita tenantId null no token mesmo com clínica no banco', async () => {
      prisma.user.findUnique.mockResolvedValue(dualUser);

      const user = await strategy.validate({
        sub: 'user-1',
        email: dualUser.email,
        tenantId: null,
        tv: 2,
      });

      expect(user).toMatchObject({ tenantId: null, isSuperAdmin: true, canChoosePanel: true, roleName: 'Administrador' });
    });

    it('modo clínica exige tenantId igual ao do usuário', async () => {
      prisma.user.findUnique.mockResolvedValue(dualUser);

      const user = await strategy.validate({
        sub: 'user-1',
        email: dualUser.email,
        tenantId: 'tenant-1',
        tv: 2,
      });

      expect(user).toMatchObject({ tenantId: 'tenant-1', roleName: 'Recepção', canChoosePanel: true });
    });
  });

  describe('tokenVersion (logout)', () => {
    it('recusa JWT com tv diferente do banco', async () => {
      prisma.user.findUnique.mockResolvedValue(clinicUser);

      await expect(
        strategy.validate({ sub: 'user-1', email: clinicUser.email, tenantId: 'tenant-1', tv: 1 }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('recusa JWT sem tv', async () => {
      prisma.user.findUnique.mockResolvedValue(clinicUser);

      await expect(
        strategy.validate({ sub: 'user-1', email: clinicUser.email, tenantId: 'tenant-1' } as any),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('último acesso', () => {
    it('grava lastAccessAt quando o último registro é antigo', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...clinicUser, lastAccessAt: new Date(Date.now() - 10 * 60_000) });

      const user = await strategy.validate({
        sub: 'user-1',
        email: clinicUser.email,
        tenantId: 'tenant-1',
        tv: 2,
      });

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { lastAccessAt: expect.any(Date) },
      });
      // Sem plano: catálogo completo (legado)
      expect(user.features).toEqual([...PLATFORM_FEATURES]);
      expect(user.tokenVersion).toBe(2);
    });

    it('não grava de novo dentro do intervalo', async () => {
      prisma.user.findUnique.mockResolvedValue(clinicUser);

      await strategy.validate({ sub: 'user-1', email: clinicUser.email, tenantId: 'tenant-1', tv: 2 });

      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('não conta personificação como acesso do usuário', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...clinicUser, lastAccessAt: null });

      await strategy.validate({
        sub: 'user-1',
        email: clinicUser.email,
        tenantId: 'tenant-1',
        tv: 2,
        impersonatorId: 'admin-1',
      });

      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });
});
