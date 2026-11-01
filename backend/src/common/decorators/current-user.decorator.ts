import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  /** Clínica do usuário. Null só para super-admin. */
  tenantId: string | null;
  /** Nome da clínica quando o super-admin está "entrando como" ela pelo painel admin. */
  tenantName?: string;
  /** Super-admin da plataforma: sem clínica e sem grupo; só usa rotas com SuperAdminGuard. */
  isSuperAdmin: boolean;
  roleId: string | null;
  roleName: string;
  permissions: string[];
  restrictToOwnAppointments: boolean;
  active: boolean;
  providesAppointments: boolean;
  /**
   * Módulos efetivos da clínica ((plano ∪ extra) − denied).
   * Sem plano = catálogo completo. Super-admin fora de clínica: [].
   */
  features: string[];
  /** Versão de sessão atual (User.tokenVersion); usada ao emitir novos JWTs. */
  tokenVersion: number;
  /** Preenchido quando um admin está personificando este usuário */
  impersonatorId?: string;
  /** Login Google com clínica + super-admin: token provisório até escolher o painel */
  panelSelectionPending?: boolean;
  /** Pode alternar entre painel da clínica e /admin (mesmo e-mail dual) */
  canChoosePanel?: boolean;
}

/**
 * Injeta o usuário autenticado (vindo do JwtStrategy.validate) no handler.
 * Uso: foo(@CurrentUser() user: AuthenticatedUser) { ... }
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
