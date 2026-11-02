import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

import { isClinicAdministrator } from '../permissions';

/**
 * Apenas administrador da clínica (grupo Administrador) em sessão com tenantId.
 * Super-admin no painel /admin (sem clínica) não passa.
 */
@Injectable()
export class ClinicAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const { user } = context.switchToHttp().getRequest();
    if (!user?.tenantId) {
      throw new ForbiddenException('Disponível apenas no painel da clínica.');
    }
    if (!isClinicAdministrator(user.roleName)) {
      throw new ForbiddenException('Apenas administradores da clínica podem acessar.');
    }
    return true;
  }
}
