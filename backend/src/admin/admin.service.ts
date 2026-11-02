import { randomBytes } from 'crypto';
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type PrismaClient, type Tenant } from '@prisma/client';
import * as bcrypt from 'bcrypt';

import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { SYSTEM_ADMIN_ROLE_NAME } from '../common/permissions';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { normalizeSpecialties } from '../common/clinic-specialties';
import { featuresFromTenant, normalizeFeatures } from '../common/platform-features';
import { TenantContext } from '../tenancy/tenant-context';
import { provisionTenant } from '../tenancy/system-roles';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { tenantProfilePrismaData } from './dto/tenant-profile.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { recordPlatformAudit, type PlatformAuditAction } from './platform-audit';

export type { PlatformAuditAction };

const PLAN_SUMMARY_SELECT = {
  id: true,
  name: true,
  slug: true,
  active: true,
  features: true,
  priceCents: true,
  currency: true,
} as const;

/** Overrides de módulos: lista normalizada ou null (limpa a coluna). undefined = não altera. */
function normalizeFeatureOverride(
  value: string[] | null | undefined,
): Prisma.InputJsonValue | typeof Prisma.DbNull | undefined {
  if (value === undefined) return undefined;
  if (value === null) return Prisma.DbNull;
  const normalized = normalizeFeatures(value);
  return normalized.length ? normalized : Prisma.DbNull;
}

function sameJson(a: unknown, b: unknown) {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

export type TenantStatusFilter = 'active' | 'suspended';

/** "Clínica Bela Vista" → "clinica-bela-vista". */
export function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '');
}

/** Início e fim do mês corrente no fuso do Brasil (UTC-3, sem horário de verão). */
export function currentBrazilMonthRange(now = new Date()): { gte: Date; lt: Date } {
  const [year, month] = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
  })
    .format(now)
    .split('-')
    .map(Number);
  const start = (y: number, m: number) =>
    new Date(`${y}-${String(m).padStart(2, '0')}-01T00:00:00-03:00`);
  return { gte: start(year, month), lt: month === 12 ? start(year + 1, 1) : start(year, month + 1) };
}

/**
 * Painel do super-admin: gestão das clínicas (tenants), métricas de uso e "entrar como".
 * Lê dados de todas as clínicas, por isso tudo roda em TenantContext.runUnscoped.
 * Toda ação que altera algo ou dá acesso a uma clínica vai para platform_audit_logs.
 */
@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
  ) {}

  listTenants(params: { search?: string; status?: TenantStatusFilter }) {
    return TenantContext.runUnscoped(async () => {
      const search = params.search?.trim();
      const where: Prisma.TenantWhereInput = {
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { slug: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
        ...(params.status ? { active: params.status === 'active' } : {}),
      };
      const tenants = await this.prisma.tenant.findMany({
        where,
        orderBy: { name: 'asc' },
        include: {
          plan: { select: PLAN_SUMMARY_SELECT },
          _count: { select: { users: { where: { active: true } }, patients: true } },
        },
      });
      const ids = tenants.map((t) => t.id);
      const [lastAccess, appointments] = await Promise.all([
        this.prisma.user.groupBy({
          by: ['tenantId'],
          where: { tenantId: { in: ids } },
          _max: { lastAccessAt: true },
        }),
        this.prisma.appointment.groupBy({
          by: ['tenantId'],
          where: { tenantId: { in: ids }, startAt: currentBrazilMonthRange() },
          _count: { _all: true },
        }),
      ]);
      const lastAccessBy = new Map(lastAccess.map((r) => [r.tenantId, r._max.lastAccessAt]));
      const appointmentsBy = new Map(appointments.map((r) => [r.tenantId, r._count._all]));

      return tenants.map(({ _count, ...tenant }) => ({
        ...tenant,
        specialties: normalizeSpecialties(tenant.specialties),
        metrics: {
          activeUsers: _count.users,
          patients: _count.patients,
          appointmentsThisMonth: appointmentsBy.get(tenant.id) ?? 0,
          lastAccessAt: lastAccessBy.get(tenant.id) ?? null,
        },
      }));
    });
  }

  getTenant(id: string) {
    return TenantContext.runUnscoped(async () => {
      const tenant = await this.findTenantOrThrow(id);
      const [activeUsers, totalUsers, patients, appointmentsThisMonth, lastAccess, documents, photos, admins] =
        await Promise.all([
          this.prisma.user.count({ where: { tenantId: id, active: true } }),
          this.prisma.user.count({ where: { tenantId: id } }),
          this.prisma.patient.count({ where: { tenantId: id } }),
          this.prisma.appointment.count({ where: { tenantId: id, startAt: currentBrazilMonthRange() } }),
          this.prisma.user.aggregate({ where: { tenantId: id }, _max: { lastAccessAt: true } }),
          this.prisma.document.aggregate({ where: { tenantId: id }, _sum: { size: true }, _count: { _all: true } }),
          this.prisma.patientPhoto.aggregate({ where: { tenantId: id }, _sum: { size: true }, _count: { _all: true } }),
          this.prisma.user.findMany({
            where: { tenantId: id, role: { name: SYSTEM_ADMIN_ROLE_NAME } },
            select: { id: true, name: true, email: true, active: true, lastAccessAt: true },
            orderBy: { createdAt: 'asc' },
          }),
        ]);

      return {
        ...tenant,
        specialties: normalizeSpecialties(tenant.specialties),
        featuresExtra: normalizeFeatures(tenant.featuresExtra),
        featuresDenied: normalizeFeatures(tenant.featuresDenied),
        effectiveFeatures: featuresFromTenant(tenant),
        admins,
        metrics: {
          activeUsers,
          totalUsers,
          patients,
          appointmentsThisMonth,
          lastAccessAt: lastAccess._max.lastAccessAt,
          // Documentos e fotos de pacientes no R2 (bytes informados no upload)
          storageBytes: (documents._sum.size ?? 0) + (photos._sum.size ?? 0),
          files: documents._count._all + photos._count._all,
        },
      };
    });
  }

  createTenant(dto: CreateTenantDto, actor: AuthenticatedUser) {
    return TenantContext.runUnscoped(async () => {
      const slug = dto.slug ?? slugify(dto.name);
      await this.assertSlugFree(slug);
      const plan = dto.planId ? await this.findAssignablePlan(dto.planId) : null;
      if (await this.prisma.user.findUnique({ where: { email: dto.adminEmail } })) {
        throw new ConflictException('Este e-mail já pertence a um usuário da plataforma.');
      }

      // Login é via Google; a senha só preenche o campo obrigatório.
      const password = await bcrypt.hash(randomBytes(32).toString('hex'), 10);
      const tenant = await provisionTenant(
        this.prisma as unknown as PrismaClient,
        {
          name: dto.name,
          slug,
          planId: plan?.id ?? null,
          ...tenantProfilePrismaData(dto, 'create'),
        },
        { name: dto.adminName, email: dto.adminEmail, password },
      );
      await this.audit(actor, 'TENANT_CREATE', tenant, {
        slug,
        adminName: dto.adminName,
        adminEmail: dto.adminEmail,
        ...(plan ? { plan: { id: plan.id, name: plan.name } } : {}),
      });
      return { ...tenant, plan };
    });
  }

  updateTenant(id: string, dto: UpdateTenantDto, actor: AuthenticatedUser) {
    return TenantContext.runUnscoped(async () => {
      const before = await this.findTenantOrThrow(id);
      if (dto.slug && dto.slug !== before.slug) await this.assertSlugFree(dto.slug);
      // undefined = não mexe no plano; null = remove o plano
      const planChanged = dto.planId !== undefined && dto.planId !== before.planId;
      const newPlan = planChanged && dto.planId ? await this.findAssignablePlan(dto.planId) : null;
      const featuresExtraData = normalizeFeatureOverride(dto.featuresExtra);
      const featuresDeniedData = normalizeFeatureOverride(dto.featuresDenied);

      const profileData = tenantProfilePrismaData(dto, 'update');
      const { plan, ...updated } = await this.prisma.tenant.update({
        where: { id },
        data: {
          name: dto.name,
          slug: dto.slug,
          ...(planChanged ? { planId: newPlan?.id ?? null } : {}),
          ...(featuresExtraData !== undefined ? { featuresExtra: featuresExtraData } : {}),
          ...(featuresDeniedData !== undefined ? { featuresDenied: featuresDeniedData } : {}),
          ...profileData,
        },
        include: { plan: { select: PLAN_SUMMARY_SELECT } },
      });
      const changes: Record<string, { old: unknown; new: unknown }> = {};
      for (const key of ['name', 'slug'] as const) {
        if (dto[key] !== undefined && before[key] !== updated[key]) {
          changes[key] = { old: before[key], new: updated[key] };
        }
      }
      for (const key of ['legalName', 'document', 'phone', 'email', 'city', 'state', 'notes'] as const) {
        if (!(key in profileData)) continue;
        if (before[key] !== updated[key]) changes[key] = { old: before[key], new: updated[key] };
      }
      if ('specialties' in profileData) {
        const oldS = normalizeSpecialties(before.specialties);
        const newS = normalizeSpecialties(updated.specialties);
        if (!sameJson(oldS, newS)) changes.specialties = { old: oldS, new: newS };
      }
      if ('foundedAt' in profileData) {
        const oldDay = before.foundedAt?.toISOString().slice(0, 10) ?? null;
        const newDay = updated.foundedAt?.toISOString().slice(0, 10) ?? null;
        if (oldDay !== newDay) changes.foundedAt = { old: oldDay, new: newDay };
      }
      if (Object.keys(changes).length) await this.audit(actor, 'TENANT_UPDATE', updated, changes);
      if (planChanged) {
        const oldPlan = before.planId
          ? await this.prisma.plan.findUnique({ where: { id: before.planId }, select: { id: true, name: true } })
          : null;
        await this.audit(actor, 'TENANT_PLAN_CHANGE', updated, {
          old: oldPlan,
          new: newPlan ? { id: newPlan.id, name: newPlan.name } : null,
        });
      }
      const featureOverridesChanged =
        !sameJson(before.featuresExtra, updated.featuresExtra) ||
        !sameJson(before.featuresDenied, updated.featuresDenied);
      if (featureOverridesChanged) {
        await this.audit(actor, 'TENANT_FEATURES_CHANGE', updated, {
          old: {
            featuresExtra: normalizeFeatures(before.featuresExtra),
            featuresDenied: normalizeFeatures(before.featuresDenied),
          },
          new: {
            featuresExtra: normalizeFeatures(updated.featuresExtra),
            featuresDenied: normalizeFeatures(updated.featuresDenied),
          },
          effectiveFeatures: featuresFromTenant({ ...updated, plan }),
        });
      }
      return {
        ...updated,
        specialties: normalizeSpecialties(updated.specialties),
        plan,
        featuresExtra: normalizeFeatures(updated.featuresExtra),
        featuresDenied: normalizeFeatures(updated.featuresDenied),
        effectiveFeatures: featuresFromTenant({ ...updated, plan }),
      };
    });
  }

  /** Suspende a clínica: login e requisições dos usuários dela passam a ser recusados (TENANT_SUSPENDED). */
  suspendTenant(id: string, reason: string | undefined, actor: AuthenticatedUser) {
    return TenantContext.runUnscoped(async () => {
      const tenant = await this.findTenantOrThrow(id);
      if (!tenant.active) return tenant;
      const updated = await this.prisma.tenant.update({
        where: { id },
        data: { active: false, suspendedAt: new Date() },
      });
      await this.audit(actor, 'TENANT_SUSPEND', updated, reason ? { reason } : undefined);
      return updated;
    });
  }

  reactivateTenant(id: string, actor: AuthenticatedUser) {
    return TenantContext.runUnscoped(async () => {
      const tenant = await this.findTenantOrThrow(id);
      if (tenant.active) return tenant;
      const updated = await this.prisma.tenant.update({
        where: { id },
        data: { active: true, suspendedAt: null },
      });
      await this.audit(actor, 'TENANT_REACTIVATE', updated);
      return updated;
    });
  }

  /**
   * "Entrar como" a clínica: token do próprio super-admin com a clínica alvo, agindo como
   * administrador dela (ver JwtStrategy). Sempre registrado na auditoria da plataforma.
   */
  enterTenant(id: string, actor: AuthenticatedUser) {
    return TenantContext.runUnscoped(async () => {
      const tenant = await this.findTenantOrThrow(id);
      const accessToken = await this.auth.signTenantAccess(actor, tenant.id);
      await this.audit(actor, 'TENANT_ENTER', tenant, tenant.active ? undefined : { suspended: true });
      return { access_token: accessToken, tenant: { id: tenant.id, name: tenant.name } };
    });
  }

  async listAudit(params: { tenantId?: string; action?: string; page?: number; limit?: number }) {
    const page = Math.max(params.page ?? 1, 1);
    const limit = Math.min(Math.max(params.limit ?? 50, 1), 100);
    const where: Prisma.PlatformAuditLogWhereInput = {
      ...(params.tenantId ? { targetTenantId: params.tenantId } : {}),
      ...(params.action ? { action: params.action } : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.platformAuditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.platformAuditLog.count({ where }),
    ]);
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  /** Só planos ativos podem ser atribuídos (desativado continua com quem já tem). */
  private async findAssignablePlan(planId: string) {
    const plan = await this.prisma.plan.findUnique({ where: { id: planId }, select: PLAN_SUMMARY_SELECT });
    if (!plan) throw new NotFoundException('Plano não encontrado.');
    if (!plan.active) throw new BadRequestException(`O plano "${plan.name}" está desativado.`);
    return plan;
  }

  private async findTenantOrThrow(id: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id }, include: { plan: { select: PLAN_SUMMARY_SELECT } } });
    if (!tenant) throw new NotFoundException('Clínica não encontrada.');
    return tenant;
  }

  private async assertSlugFree(slug: string) {
    if (!slug) throw new BadRequestException('Informe um identificador para a clínica.');
    if (await this.prisma.tenant.findUnique({ where: { slug } })) {
      throw new ConflictException(`Já existe uma clínica com o identificador "${slug}".`);
    }
  }

  private audit(
    actor: AuthenticatedUser,
    action: PlatformAuditAction,
    tenant: Pick<Tenant, 'id' | 'name'>,
    details?: Record<string, unknown>,
  ) {
    return recordPlatformAudit(this.prisma, actor, action, { tenantId: tenant.id, name: tenant.name }, details);
  }
}
