import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DiscountType, Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { CreatePromotionDto } from './dto/create-promotion.dto';
import { UpdatePromotionDto } from './dto/update-promotion.dto';
import { parseDateOnlyToUtcNoon } from '../common/utils/date-only.util';
import { AuditLogService, AuditUser } from '../audit-log/audit-log.service';

export interface PromotionQuote {
  originalPrice: number;
  discount: number;
  finalPrice: number;
  promotion: { id: string; name: string; discountType: DiscountType; discountValue: number } | null;
}

@Injectable()
export class PromotionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  private readonly defaultInclude = {
    procedures: { include: { procedure: { select: { id: true, name: true, price: true } } } },
    packages: { include: { package: { select: { id: true, name: true, totalPrice: true } } } },
    _count: { select: { appointments: true } },
  } as const;

  list() {
    return this.prisma.promotion.findMany({
      include: this.defaultInclude,
      orderBy: { startAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const promo = await this.prisma.promotion.findUnique({
      where: { id },
      include: this.defaultInclude,
    });
    if (!promo) throw new NotFoundException('Promoção não encontrada');
    return promo;
  }

  async create(dto: CreatePromotionDto, user?: AuditUser) {
    this.assertComboRules(
      dto.discountType as DiscountType,
      dto.discountValue,
      (dto.procedureIds?.length ?? 0) + (dto.packageIds?.length ?? 0),
    );
    const created = await this.prisma.promotion.create({
      data: {
        name: dto.name,
        description: dto.description,
        commemorativeDate: dto.commemorativeDate,
        startAt: parseDateOnlyToUtcNoon(dto.startAt)!,
        endAt: parseDateOnlyToUtcNoon(dto.endAt)!,
        discountType: dto.discountType as DiscountType,
        discountValue: dto.discountValue,
        active: dto.active ?? true,
        procedures: dto.procedureIds?.length
          ? { create: dto.procedureIds.map((procedureId) => ({ procedureId })) }
          : undefined,
        packages: dto.packageIds?.length
          ? { create: dto.packageIds.map((packageId) => ({ packageId })) }
          : undefined,
      },
      include: this.defaultInclude,
    });
    this.auditLog.logCreate('Promotion', created.id, created as unknown as Record<string, unknown>, user).catch(() => undefined);
    return created;
  }

  async update(id: string, dto: UpdatePromotionDto, user?: AuditUser) {
    const existing = await this.prisma.promotion.findUnique({
      where: { id },
      include: { _count: { select: { procedures: true, packages: true } } },
    });
    if (!existing) throw new NotFoundException('Promoção não encontrada');
    const { _count: linkCount, ...existingData } = existing;
    this.assertComboRules(
      (dto.discountType as DiscountType | undefined) ?? existing.discountType,
      dto.discountValue ?? Number(existing.discountValue),
      (dto.procedureIds?.length ?? linkCount.procedures) +
        (dto.packageIds?.length ?? linkCount.packages),
    );

    const updated = await this.prisma.$transactionWithRetry(async (tx) => {
      // Atualizar vínculos com procedimentos
      if (dto.procedureIds !== undefined) {
        await tx.promotionProcedure.deleteMany({ where: { promotionId: id } });
        if (dto.procedureIds.length > 0) {
          await tx.promotionProcedure.createMany({
            data: dto.procedureIds.map((procedureId) => ({ promotionId: id, procedureId })),
          });
        }
      }

      // Atualizar vínculos com pacotes
      if (dto.packageIds !== undefined) {
        await tx.promotionPackage.deleteMany({ where: { promotionId: id } });
        if (dto.packageIds.length > 0) {
          await tx.promotionPackage.createMany({
            data: dto.packageIds.map((packageId) => ({ promotionId: id, packageId })),
          });
        }
      }

      return tx.promotion.update({
        where: { id },
        data: {
          name: dto.name,
          description: dto.description,
          commemorativeDate: dto.commemorativeDate,
          startAt: dto.startAt !== undefined ? parseDateOnlyToUtcNoon(dto.startAt) : undefined,
          endAt: dto.endAt !== undefined ? parseDateOnlyToUtcNoon(dto.endAt) : undefined,
          discountType: dto.discountType as DiscountType | undefined,
          discountValue: dto.discountValue,
          active: dto.active,
        },
        include: this.defaultInclude,
      });
    });
    this.auditLog.logUpdate('Promotion', id, existingData as unknown as Record<string, unknown>, updated as unknown as Record<string, unknown>, user).catch(() => undefined);
    return updated;
  }

  async remove(id: string, user?: AuditUser) {
    const existing = await this.prisma.promotion.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Promoção não encontrada');
    await this.prisma.promotion.delete({ where: { id } });
    this.auditLog.logDelete('Promotion', id, existing as unknown as Record<string, unknown>, user).catch(() => undefined);
    return { ok: true };
  }

  /**
   * Melhor promoção ativa no dia para um procedimento avulso. Promoções sem procedimentos
   * nem pacotes vinculados valem para todos os procedimentos (exceto combo, que exige vínculo).
   * Pacotes não entram aqui: o desconto deles é aplicado na venda (`quoteForPackage`).
   */
  quoteForProcedure(procedureId: string, price: number, day: Date) {
    return this.bestQuote(price, day, {
      OR: [
        { procedures: { some: { procedureId } } },
        {
          procedures: { none: {} },
          packages: { none: {} },
          discountType: { not: DiscountType.COMBO },
        },
      ],
    });
  }

  /** Melhor promoção ativa no dia para a venda de um pacote (só promoções vinculadas a ele). */
  quoteForPackage(packageId: string, price: number, day: Date) {
    return this.bestQuote(price, day, { packages: { some: { packageId } } });
  }

  /**
   * `day` é o dia do calendário como meio-dia UTC, no mesmo formato de `startAt`/`endAt`.
   * Entre várias promoções ativas, vence a que resulta no menor preço.
   */
  private async bestQuote(
    price: number,
    day: Date,
    scope: Prisma.PromotionWhereInput,
  ): Promise<PromotionQuote> {
    const promos = await this.prisma.promotion.findMany({
      where: { active: true, startAt: { lte: day }, endAt: { gte: day }, ...scope },
      select: { id: true, name: true, discountType: true, discountValue: true },
    });

    let best: PromotionQuote = { originalPrice: price, discount: 0, finalPrice: price, promotion: null };
    for (const promo of promos) {
      const discountValue = Number(promo.discountValue);
      const finalPrice = this.applyDiscount(price, promo.discountType, discountValue);
      if (finalPrice < best.finalPrice) {
        best = {
          originalPrice: price,
          discount: Math.round((price - finalPrice) * 100) / 100,
          finalPrice,
          promotion: { ...promo, discountValue },
        };
      }
    }
    return best;
  }

  /**
   * Calcula o valor com desconto aplicado. Combo é preço fechado: `discountValue` é o valor
   * final do procedimento/pacote na campanha (nunca acima do preço cheio).
   */
  applyDiscount(
    originalPrice: number,
    discountType: DiscountType,
    discountValue: number,
  ): number {
    if (discountType === DiscountType.PERCENTAGE) {
      return Math.round(originalPrice * (1 - discountValue / 100) * 100) / 100;
    }
    if (discountType === DiscountType.COMBO) {
      return discountValue > 0 ? Math.min(originalPrice, discountValue) : originalPrice;
    }
    return Math.max(0, Math.round((originalPrice - discountValue) * 100) / 100);
  }

  /** Rótulo curto do desconto para descrições de lançamentos. */
  discountLabel(promotion: NonNullable<PromotionQuote['promotion']>): string {
    const brl = `R$ ${promotion.discountValue.toFixed(2)}`;
    if (promotion.discountType === DiscountType.PERCENTAGE) return `-${promotion.discountValue}%`;
    if (promotion.discountType === DiscountType.COMBO) return `combo ${brl}`;
    return `-${brl}`;
  }

  private assertComboRules(
    discountType: DiscountType,
    discountValue: number,
    linkedCount: number,
  ) {
    if (discountType !== DiscountType.COMBO) return;
    if (!(discountValue > 0)) {
      throw new BadRequestException('Informe o preço do combo.');
    }
    if (linkedCount === 0) {
      throw new BadRequestException('Combo precisa de procedimentos ou pacotes específicos.');
    }
  }
}
