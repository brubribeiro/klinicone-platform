import { ExecutionContext, ForbiddenException } from '@nestjs/common';

import { SuperAdminGuard } from './super-admin.guard';

const ctx = (user: unknown) =>
  ({ switchToHttp: () => ({ getRequest: () => ({ user }) }) }) as unknown as ExecutionContext;

describe('SuperAdminGuard', () => {
  const guard = new SuperAdminGuard();

  it('libera o super-admin', () => {
    expect(guard.canActivate(ctx({ id: 'root', isSuperAdmin: true, tenantId: null }))).toBe(true);
  });

  it('libera o super-admin "entrando como" uma clínica (impersonatorId)', () => {
    expect(
      guard.canActivate(
        ctx({ id: 'root', isSuperAdmin: true, tenantId: 't1', impersonatorId: 'root', roleName: 'Administrador' }),
      ),
    ).toBe(true);
  });

  it('recusa super-admin dual no painel da clínica', () => {
    expect(() =>
      guard.canActivate(ctx({ id: 'root', isSuperAdmin: true, tenantId: 't1', roleName: 'Administrador' })),
    ).toThrow(ForbiddenException);
  });

  it('recusa token pendente de escolha de painel', () => {
    expect(() =>
      guard.canActivate(ctx({ id: 'root', isSuperAdmin: true, tenantId: null, panelSelectionPending: true })),
    ).toThrow(ForbiddenException);
  });

  it('recusa administrador de clínica', () => {
    expect(() => guard.canActivate(ctx({ id: 'u1', isSuperAdmin: false, tenantId: 't1', roleName: 'Administrador' }))).toThrow(
      ForbiddenException,
    );
  });

  it('recusa requisição sem usuário', () => {
    expect(() => guard.canActivate(ctx(undefined))).toThrow(ForbiddenException);
  });
});
