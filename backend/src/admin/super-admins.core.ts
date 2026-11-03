import { randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import type { Prisma, PrismaClient, User } from '@prisma/client';

/** Subconjunto do Prisma usado para criar/promover/revogar super-admins (script e API). */
export type SuperAdminPrisma = {
  user: {
    findUnique: PrismaClient['user']['findUnique'];
    findMany: PrismaClient['user']['findMany'];
    create: PrismaClient['user']['create'];
    update: PrismaClient['user']['update'];
    delete: PrismaClient['user']['delete'];
    count: PrismaClient['user']['count'];
  };
  appointment: {
    count: PrismaClient['appointment']['count'];
  };
};

export type EnsureSuperAdminResult =
  | { status: 'already'; user: User; renamed: boolean }
  | { status: 'promoted'; user: User }
  | { status: 'created'; user: User };

export type RevokeSuperAdminResult =
  | { outcome: 'demoted'; user: User }
  | { outcome: 'deactivated'; user: User }
  | { outcome: 'deleted'; user: User };

const LIST_SELECT = {
  id: true,
  name: true,
  email: true,
  tenantId: true,
  active: true,
  createdAt: true,
  lastAccessAt: true,
  tenant: { select: { id: true, name: true, slug: true } },
} satisfies Prisma.UserSelect;

export type SuperAdminListItem = Prisma.UserGetPayload<{ select: typeof LIST_SELECT }> & {
  hasClinic: boolean;
};

/** E-mail normalizado (trim + minúsculas). */
export function normalizeSuperAdminEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Cria super-admin puro ou promove usuário de clínica (mantém tenantId/grupo).
 * Mesma regra do antigo `prisma/create-super-admin.ts`.
 */
export async function ensureSuperAdmin(
  prisma: SuperAdminPrisma,
  opts: { email: string; name: string; nameProvided: boolean },
): Promise<EnsureSuperAdminResult> {
  const email = normalizeSuperAdminEmail(opts.email);
  const name = opts.name.trim() || 'Super-admin';
  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing?.isSuperAdmin) {
    if (opts.nameProvided && existing.name !== name) {
      const user = await prisma.user.update({ where: { email }, data: { name } });
      return { status: 'already', user, renamed: true };
    }
    return { status: 'already', user: existing, renamed: false };
  }

  if (existing) {
    const data: { isSuperAdmin: true; name?: string } = { isSuperAdmin: true };
    if (opts.nameProvided) data.name = name;
    const user = await prisma.user.update({ where: { email }, data });
    return { status: 'promoted', user };
  }

  // Login via Google; a senha só preenche o campo obrigatório.
  const password = await bcrypt.hash(randomBytes(32).toString('hex'), 10);
  const user = await prisma.user.create({
    data: {
      name,
      email,
      password,
      isSuperAdmin: true,
      tenantId: null,
      roleId: null,
      providesAppointments: false,
    },
  });
  return { status: 'created', user };
}

/** Lista super-admins com clínica (login dual) quando houver. */
export async function listSuperAdmins(prisma: SuperAdminPrisma): Promise<SuperAdminListItem[]> {
  const rows = await prisma.user.findMany({
    where: { isSuperAdmin: true },
    select: LIST_SELECT,
    orderBy: [{ name: 'asc' }, { email: 'asc' }],
  });
  return rows.map((row) => ({ ...row, hasClinic: !!row.tenantId }));
}

/**
 * Remove a permissão de super-admin.
 * Dual (com clínica): só tira `isSuperAdmin` e incrementa `tokenVersion`.
 * Puro: desativa se tiver agendamentos, senão exclui (padrão de usuários); invalida JWT.
 */
export async function revokeSuperAdmin(
  prisma: SuperAdminPrisma,
  opts: { targetId: string; actorId: string },
): Promise<RevokeSuperAdminResult> {
  if (opts.targetId === opts.actorId) {
    throw new SuperAdminRuleError('self', 'Você não pode remover a própria permissão de super-admin.');
  }

  const target = await prisma.user.findUnique({ where: { id: opts.targetId } });
  if (!target?.isSuperAdmin) {
    throw new SuperAdminRuleError('not_found', 'Super-admin não encontrado.');
  }

  const others = await prisma.user.count({
    where: { isSuperAdmin: true, id: { not: opts.targetId } },
  });
  if (others === 0) {
    throw new SuperAdminRuleError('last', 'Não é possível remover o último super-admin da plataforma.');
  }

  if (target.tenantId) {
    const user = await prisma.user.update({
      where: { id: target.id },
      data: { isSuperAdmin: false, tokenVersion: { increment: 1 } },
    });
    return { outcome: 'demoted', user };
  }

  const apptCount = await prisma.appointment.count({ where: { professionalId: target.id } });
  if (apptCount > 0) {
    const user = await prisma.user.update({
      where: { id: target.id },
      data: { active: false, isSuperAdmin: false, tokenVersion: { increment: 1 } },
    });
    return { outcome: 'deactivated', user };
  }

  await prisma.user.delete({ where: { id: target.id } });
  return { outcome: 'deleted', user: target };
}

/** Erros de regra de negócio (mapeados para HTTP no service Nest). */
export class SuperAdminRuleError extends Error {
  constructor(
    readonly code: 'self' | 'last' | 'not_found' | 'invalid_email',
    message: string,
  ) {
    super(message);
    this.name = 'SuperAdminRuleError';
  }
}
