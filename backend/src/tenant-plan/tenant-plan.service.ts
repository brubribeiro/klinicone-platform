import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { featuresFromTenant } from '../common/platform-features';
import type { PlanLimitsDto } from '../admin/dto/plan.dto';

export type TenantPlanUsage = {
  activeUsers: number;
  patients: number;
  storageBytes: number;
  files: number;
};

export type TenantPlanSummary = {
  plan: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    priceCents: number | null;
    currency: string;
    limits: PlanLimitsDto | null;
  } | null;
  usage: TenantPlanUsage;
  features: string[];
};

export function parseLimits(raw: unknown): PlanLimitsDto | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const limits: PlanLimitsDto = {};
  if (typeof o.maxUsers === 'number') limits.maxUsers = o.maxUsers;
  if (typeof o.maxPatients === 'number') limits.maxPatients = o.maxPatients;
  if (typeof o.storageGb === 'number') limits.storageGb = o.storageGb;
  return Object.keys(limits).length ? limits : null;
}

@Injectable()
export class TenantPlanService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(tenantId: string): Promise<TenantPlanSummary> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        plan: {
          select: {
            id: true,
            name: true,
            slug: true,
            description: true,
            priceCents: true,
            currency: true,
            limits: true,
            features: true,
          },
        },
      },
    });
    if (!tenant) throw new NotFoundException('Clínica não encontrada.');

    const [activeUsers, patients, documents, photos] = await Promise.all([
      this.prisma.user.count({ where: { tenantId, active: true } }),
      this.prisma.patient.count({ where: { tenantId } }),
      this.prisma.document.aggregate({ where: { tenantId }, _sum: { size: true }, _count: { _all: true } }),
      this.prisma.patientPhoto.aggregate({ where: { tenantId }, _sum: { size: true }, _count: { _all: true } }),
    ]);

    const plan = tenant.plan
      ? {
          id: tenant.plan.id,
          name: tenant.plan.name,
          slug: tenant.plan.slug,
          description: tenant.plan.description,
          priceCents: tenant.plan.priceCents,
          currency: tenant.plan.currency,
          limits: parseLimits(tenant.plan.limits),
        }
      : null;

    return {
      plan,
      usage: {
        activeUsers,
        patients,
        storageBytes: (documents._sum.size ?? 0) + (photos._sum.size ?? 0),
        files: documents._count._all + photos._count._all,
      },
      features: featuresFromTenant(tenant),
    };
  }
}
