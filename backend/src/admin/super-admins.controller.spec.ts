import { ForbiddenException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';

jest.mock('bcrypt', () => ({ hash: jest.fn().mockResolvedValue('hashed') }));

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SuperAdminGuard } from '../tenancy/super-admin.guard';
import { SuperAdminsController } from './super-admins.controller';
import { SuperAdminsService } from './super-admins.service';

describe('SuperAdminsController', () => {
  const actor = { id: 'root-1', name: 'Dono', email: 'root@platform.dev', isSuperAdmin: true } as any;
  let service: jest.Mocked<Pick<SuperAdminsService, 'list' | 'create' | 'remove'>>;
  let controller: SuperAdminsController;

  beforeEach(() => {
    service = {
      list: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({ id: 'sa-1' }),
      remove: jest.fn().mockResolvedValue({ ok: true, outcome: 'demoted' }),
    };
    controller = new SuperAdminsController(service as unknown as SuperAdminsService);
  });

  it('exige JwtAuthGuard e SuperAdminGuard', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, SuperAdminsController) ?? [];
    expect(guards).toEqual(expect.arrayContaining([JwtAuthGuard, SuperAdminGuard]));
  });

  it('SuperAdminGuard recusa quem não é super-admin (mesmo padrão das demais rotas /admin)', () => {
    const guard = new SuperAdminGuard();
    const ctx = {
      switchToHttp: () => ({
        getRequest: () => ({ user: { id: 'u1', isSuperAdmin: false, tenantId: 't1' } }),
      }),
    } as any;
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('lista via service', async () => {
    await controller.list();
    expect(service.list).toHaveBeenCalled();
  });

  it('cria passando o actor autenticado', async () => {
    const dto = { email: 'a@b.com', name: 'Ana' };
    await controller.create(dto, actor);
    expect(service.create).toHaveBeenCalledWith(dto, actor);
  });

  it('remove passando id e actor', async () => {
    await controller.remove('sa-dual', actor);
    expect(service.remove).toHaveBeenCalledWith('sa-dual', actor);
  });
});
