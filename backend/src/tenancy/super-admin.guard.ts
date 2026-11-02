import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';

/**
 * Libera a rota só para super-admin (usuário sem clínica). Usar depois do JwtAuthGuard:
 * @UseGuards(JwtAuthGuard, SuperAdminGuard). O contexto fica sem tenant: para ler dados
 * de clínicas use TenantContext.runUnscoped ou TenantContext.run(tenantId).
 */
@Injectable()
export class SuperAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const user: AuthenticatedUser | undefined = context.switchToHttp().getRequest().user;
    if (!user?.isSuperAdmin) {
      throw new ForbiddenException('Acesso restrito ao super-admin da plataforma.');
    }
    if (user.panelSelectionPending) {
      throw new ForbiddenException('Escolha o painel da plataforma ou da clínica antes de continuar.');
    }
    // Super-admin dual no painel da clínica (sem "entrar como") não acessa rotas /admin.
    if (user.tenantId && user.impersonatorId !== user.id) {
      throw new ForbiddenException('Use o painel da plataforma para acessar esta área.');
    }
    return true;
  }
}
