import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type Plan } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { normalizeFeatures } from '../common/platform-features';
import { TenantContext } from '../tenancy/tenant-context';
import { slugify } from './admin.service';
import { CreatePlanDto, PlanLimitsDto, UpdatePlanDto } from './dto/plan.dto';
import { recordPlatformAudit } from './platform-audit';

const LIMIT_KEYS = ['maxUsers', 'maxPatients', 'storageGb'] as const;

/** Guarda só os limites informados; sem nenhum, a coluna fica nula (ilimitado). */
export function normalizeLimits(
  limits: PlanLimitsDto | null | undefined,
): Prisma.InputJsonObject | typeof Prisma.DbNull | undefined {
  if (limits === undefined) return undefined;
  const out: Record<string, number> = {};
  for (const key of LIMIT_KEYS) {
    const value = limits?.[key];
    if (value !== undefined && value !== null) out[key] = value;
  }
  return Object.keys(out).length ? out : Prisma.DbNull;
}

/** Lista de módulos; vazio/null → coluna nula. undefined → não altera. */
export function normalizePlanFeatures(
  features: string[] | null | undefined,
): Prisma.InputJsonValue | typeof Prisma.DbNull | undefined {
  if (features === undefined) return undefined;
  if (features === null) return Prisma.DbNull;
  const normalized = normalizeFeatures(features);
  return normalized.length ? normalized : Prisma.DbNull;
}

/**
 * Planos da plataforma: preço de referência, módulos e limites (aplicados em src/plan-limits).
 * Plano não se exclui: desativado, some do seletor de novas clínicas e quem já tem continua com ele.
 */
@Injectable()
export class PlansService {
  constructor(private readonly prisma: PrismaService) {}

  listPlans() {
    return TenantContext.runUnscoped(async () => {
      const plans = await this.prisma.plan.findMany({
        orderBy: { createdAt: 'asc' },
        include: { _count: { select: { tenants: true } } },
      });
      return plans.map(({ _count, ...plan }) => ({ ...plan, tenantCount: _count.tenants }));
    });
  }

  getPlan(id: string) {
    return TenantContext.runUnscoped(async () => {
      const plan = await this.findPlanOrThrow(id);
      const tenantCount = await this.prisma.tenant.count({ where: { planId: id } });
      return { ...plan, tenantCount };
    });
  }

  createPlan(dto: CreatePlanDto, actor: AuthenticatedUser) {
    return TenantContext.runUnscoped(async () => {
      const slug = dto.slug ?? slugify(dto.name);
      await this.assertSlugFree(slug);
      const plan = await this.prisma.plan.create({
        data: {
          name: dto.name,
          slug,
          description: dto.description ?? null,
          priceCents: dto.priceCents ?? null,
          currency: (dto.currency?.trim() || 'BRL').toUpperCase(),
          features: normalizePlanFeatures(dto.features ?? null),
          limits: normalizeLimits(dto.limits ?? null),
        },
      });
      const createdFeatures = normalizeFeatures(plan.features);
      await this.audit(actor, 'PLAN_CREATE', plan, {
        slug,
        ...(plan.priceCents != null ? { priceCents: plan.priceCents, currency: plan.currency } : {}),
        ...(createdFeatures.length ? { features: createdFeatures } : {}),
        ...(plan.limits && typeof plan.limits === 'object' ? { limits: plan.limits } : {}),
      });
      return { ...plan, tenantCount: 0 };
    });
  }

  updatePlan(id: string, dto: UpdatePlanDto, actor: AuthenticatedUser) {
    return TenantContext.runUnscoped(async () => {
      const before = await this.findPlanOrThrow(id);
      if (dto.slug && dto.slug !== before.slug) await this.assertSlugFree(dto.slug);

      const updated = await this.prisma.plan.update({
        where: { id },
        data: {
          name: dto.name,
          slug: dto.slug,
          description: dto.description,
          ...(dto.priceCents !== undefined ? { priceCents: dto.priceCents } : {}),
          ...(dto.currency !== undefined ? { currency: dto.currency.trim().toUpperCase() || 'BRL' } : {}),
          features: normalizePlanFeatures(dto.features),
          limits: normalizeLimits(dto.limits),
        },
      });
      const changes: Record<string, { old: unknown; new: unknown }> = {};
      for (const key of ['name', 'slug', 'description', 'priceCents', 'currency'] as const) {
        if (before[key] !== updated[key]) changes[key] = { old: before[key], new: updated[key] };
      }
      if (JSON.stringify(before.features) !== JSON.stringify(updated.features)) {
        changes.features = { old: before.features, new: updated.features };
      }
      if (JSON.stringify(before.limits) !== JSON.stringify(updated.limits)) {
        changes.limits = { old: before.limits, new: updated.limits };
      }
      if (Object.keys(changes).length) await this.audit(actor, 'PLAN_UPDATE', updated, changes);
      return this.withTenantCount(updated);
    });
  }

  setActive(id: string, active: boolean, actor: AuthenticatedUser) {
    return TenantContext.runUnscoped(async () => {
      const plan = await this.findPlanOrThrow(id);
      if (plan.active === active) return this.withTenantCount(plan);
      const updated = await this.prisma.plan.update({ where: { id }, data: { active } });
      await this.audit(actor, active ? 'PLAN_ACTIVATE' : 'PLAN_DEACTIVATE', updated);
      return this.withTenantCount(updated);
    });
  }

  private async withTenantCount(plan: Plan) {
    return { ...plan, tenantCount: await this.prisma.tenant.count({ where: { planId: plan.id } }) };
  }

  private async findPlanOrThrow(id: string): Promise<Plan> {
    const plan = await this.prisma.plan.findUnique({ where: { id } });
    if (!plan) throw new NotFoundException('Plano não encontrado.');
    return plan;
  }

  private async assertSlugFree(slug: string) {
    if (!slug) throw new BadRequestException('Informe um identificador para o plano.');
    if (await this.prisma.plan.findUnique({ where: { slug } })) {
      throw new ConflictException(`Já existe um plano com o identificador "${slug}".`);
    }
  }

  private audit(
    actor: AuthenticatedUser,
    action: 'PLAN_CREATE' | 'PLAN_UPDATE' | 'PLAN_ACTIVATE' | 'PLAN_DEACTIVATE',
    plan: Plan,
    details?: Record<string, unknown>,
  ) {
    return recordPlatformAudit(this.prisma, actor, action, { tenantId: null, name: plan.name }, {
      planId: plan.id,
      ...details,
    });
  }
}
