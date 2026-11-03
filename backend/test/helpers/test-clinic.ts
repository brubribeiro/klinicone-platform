/**
 * Clínicas temporárias para testes de integração (Postgres real, sem mocks de Prisma).
 * Cada suíte cria as suas com um sufixo aleatório e apaga tudo no fim com `purgeTenants`.
 */
import { randomUUID } from 'crypto';
import { Prisma, PrismaClient, Role, Tenant, User } from '@prisma/client';

import { TenantContext } from '../../src/tenancy/tenant-context';
import { provisionTenant } from '../../src/tenancy/system-roles';
import type { AuthenticatedUser } from '../../src/common/decorators/current-user.decorator';

export interface TestClinic {
  tenant: Tenant;
  adminRole: Role;
  admin: User;
  /** Usuário autenticado (admin) como os controllers passam aos services. */
  actor: AuthenticatedUser;
  as<T>(fn: () => Promise<T>): Promise<T>;
}

export function testSuffix() {
  return randomUUID().slice(0, 8);
}

export async function createTestClinic(base: PrismaClient, label: string, suffix: string): Promise<TestClinic> {
  const slug = `test-${label.toLowerCase()}-${suffix}`;
  const email = `admin-${slug}@fluxos.test`;
  const tenant = await provisionTenant(
    base,
    { name: `Teste ${label}`, slug },
    { name: `Admin ${label}`, email, password: 'x' },
  );
  const adminRole = await base.role.findFirstOrThrow({ where: { tenantId: tenant.id, name: 'Administrador' } });
  const admin = await base.user.findUniqueOrThrow({ where: { email } });
  const actor = {
    id: admin.id,
    email: admin.email,
    name: admin.name,
    tenantId: tenant.id,
    roleId: adminRole.id,
    isSuperAdmin: false,
    roleName: adminRole.name,
    permissions: [],
    restrictToOwnAppointments: false,
    active: true,
    providesAppointments: true,
    features: [],
    tokenVersion: admin.tokenVersion,
  } as AuthenticatedUser;
  return { tenant, adminRole, admin, actor, as: (fn) => TenantContext.run(tenant.id, fn) };
}

/** Apaga todos os dados das clínicas de teste, repetindo até as FKs deixarem. */
export async function purgeTenants(base: PrismaClient, tenantIds: string[]) {
  const tables = Prisma.dmmf.datamodel.models
    .filter((m) => m.fields.some((f) => f.name === 'tenantId'))
    .map((m) => m.dbName ?? m.name);
  let pending = [...tables];
  for (let pass = 0; pass < 10 && pending.length; pass++) {
    const failed: string[] = [];
    for (const table of pending) {
      try {
        await base.$executeRawUnsafe(`DELETE FROM "${table}" WHERE "tenantId" = ANY($1::text[])`, tenantIds);
      } catch {
        failed.push(table);
      }
    }
    pending = failed;
  }
  await base.tenant.deleteMany({ where: { id: { in: tenantIds } } });
}
