import type { Prisma, PrismaClient, Role, Tenant } from '@prisma/client';

import { ALL_PERMISSIONS, SYSTEM_ADMIN_ROLE_NAME, type Permission } from '../common/permissions';

type RoleClient = Pick<PrismaClient, 'role'> | Prisma.TransactionClient;

export interface SystemRoleDefinition {
  name: string;
  color: string;
  description: string;
  permissions: Permission[];
  restrictToOwnAppointments: boolean;
}

/** Grupos de sistema que toda clínica tem (não podem ser excluídos nem renomeados). */
export const SYSTEM_ROLES: SystemRoleDefinition[] = [
  {
    name: SYSTEM_ADMIN_ROLE_NAME,
    color: '#15998B',
    description: 'Acesso total à plataforma',
    permissions: ALL_PERMISSIONS,
    restrictToOwnAppointments: false,
  },
  {
    name: 'Profissional',
    color: '#9B7BD4',
    description: 'Vê apenas a própria agenda e edita pacientes',
    permissions: [
      'patients:view',
      'patients:edit',
      'appointments:view',
      'appointments:edit',
      'procedures:view',
      'packages:view',
      'inventory:view',
      'messages:view',
      'pendencias:view',
      'routines:view',
      'routines:create',
      'routines:edit',
    ],
    restrictToOwnAppointments: true,
  },
  {
    name: 'Recepção',
    color: '#E0915B',
    description: 'Gerencia pacientes, agenda, estoque e mensagens (sem financeiro nem profissionais)',
    permissions: [
      'patients:view',
      'patients:create',
      'patients:edit',
      'appointments:view',
      'appointments:create',
      'appointments:edit',
      'appointments:delete',
      'procedures:view',
      'packages:view',
      'packages:create',
      'packages:edit',
      'inventory:view',
      'inventory:create',
      'inventory:edit',
      'messages:view',
      'messages:create',
      'messages:edit',
      'availability:edit',
      'pendencias:view',
      'pendencias:create',
      'pendencias:edit',
      'routines:view',
    ],
    restrictToOwnAppointments: false,
  },
];

/**
 * Cria (ou atualiza permissões/descrição) dos grupos de sistema de uma clínica.
 * Idempotente. Passa tenantId explícito, então funciona com o client base ou com o
 * client escopado dentro de TenantContext.run(tenantId).
 */
export async function ensureSystemRoles(prisma: RoleClient, tenantId: string) {
  const roles: Role[] = [];
  for (const def of SYSTEM_ROLES) {
    const existing = await prisma.role.findUnique({
      where: { tenantId_name: { tenantId, name: def.name } },
    });
    if (!existing) {
      roles.push(await prisma.role.create({ data: { ...def, tenantId, isSystem: true } }));
    } else if (existing.isSystem) {
      roles.push(
        await prisma.role.update({
          where: { id: existing.id, tenantId },
          data: {
            permissions: def.permissions,
            restrictToOwnAppointments: def.restrictToOwnAppointments,
            description: def.description,
          },
        }),
      );
    } else {
      roles.push(existing);
    }
  }
  return roles;
}

/**
 * Cria uma clínica nova já com os grupos de sistema e, se informado, o primeiro usuário
 * (no grupo Administrador). Tudo numa transação. Usar com o client base (sem escopo).
 */
export async function provisionTenant(
  prisma: PrismaClient,
  data: Prisma.TenantUncheckedCreateInput,
  admin?: { name: string; email: string; password: string },
): Promise<Tenant> {
  return prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({ data });
    const roles = await ensureSystemRoles(tx, tenant.id);
    if (admin) {
      const adminRole = roles.find((r) => r.name === SYSTEM_ADMIN_ROLE_NAME)!;
      await tx.user.create({
        data: { ...admin, tenantId: tenant.id, roleId: adminRole.id },
      });
    }
    return tenant;
  });
}
