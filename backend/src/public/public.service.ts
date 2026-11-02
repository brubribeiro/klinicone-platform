import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { normalizeFeatures } from '../common/platform-features';
import { parseLimits } from '../tenant-plan/tenant-plan.service';

/** Dados da landing pública (sem login): só o que pode ser divulgado. */
@Injectable()
export class PublicService {
  constructor(private readonly prisma: PrismaService) {}

  /** Planos ativos do painel super-admin, do mais barato ao mais caro (sem preço por último). */
  async listPlans() {
    const plans = await this.prisma.plan.findMany({
      where: { active: true },
      orderBy: [{ priceCents: { sort: 'asc', nulls: 'last' } }, { createdAt: 'asc' }],
      select: {
        name: true,
        slug: true,
        description: true,
        priceCents: true,
        currency: true,
        features: true,
        limits: true,
      },
    });
    return plans.map((plan) => ({
      ...plan,
      features: normalizeFeatures(plan.features),
      limits: parseLimits(plan.limits),
    }));
  }
}
