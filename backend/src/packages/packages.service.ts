import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService, AuditUser } from '../audit-log/audit-log.service';
import { PromotionsService } from '../promotions/promotions.service';
import { toBrazilDateAtUtcNoon } from '../common/utils/brazil-time.util';
import { CreatePackageDto, PackageItemDto } from './dto/create-package.dto';
import { UpdatePackageDto } from './dto/update-package.dto';
import {
  CreatePatientPackageDto,
  UpdatePatientPackageDto,
} from './dto/create-patient-package.dto';

const packageInclude = {
  items: {
    include: { procedure: true },
    orderBy: { sortOrder: 'asc' as const },
  },
};

const patientPackageInclude = {
  package: { include: { items: { include: { procedure: true }, orderBy: { sortOrder: 'asc' as const } } } },
  patient: true,
  appointments: {
    select: { id: true, startAt: true, status: true, procedure: { select: { id: true, name: true } } },
    orderBy: { startAt: 'asc' as const },
  },
};

@Injectable()
export class PackagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly promotions: PromotionsService,
  ) {}

  // ─── CRUD de Package (template/catálogo) ───

  async list() {
    const [items, activeGroups] = await Promise.all([
      this.prisma.package.findMany({
        orderBy: { name: 'asc' },
        include: {
          ...packageInclude,
          _count: { select: { patientPackages: true } },
        },
      }),
      this.prisma.patientPackage.groupBy({
        by: ['packageId'],
        where: { status: 'ACTIVE' },
        _count: { id: true },
      }),
    ]);

    const activeMap = new Map<string, number>();
    for (const g of activeGroups) activeMap.set(g.packageId, g._count.id);

    // Descobre o mais vendido (por pacientes ativos; empate → mais vendas totais)
    let bestSellerId: string | null = null;
    let bestActive = 0;
    let bestSold = 0;
    for (const p of items) {
      const active = activeMap.get(p.id) ?? 0;
      const sold = p._count?.patientPackages ?? 0;
      if (active > bestActive || (active === bestActive && sold > bestSold)) {
        bestActive = active;
        bestSold = sold;
        bestSellerId = active > 0 || sold > 0 ? p.id : bestSellerId;
      }
    }

    return items.map((p) => {
      const originalPrice = p.items.reduce(
        (acc, it) => acc + Number(it.procedure.price) * it.quantity,
        0,
      );
      const salePrice = this.resolvePackageSalePrice(p);
      const savingsPercent =
        originalPrice > 0
          ? Math.round(((originalPrice - salePrice) / originalPrice) * 100)
          : 0;
      return {
        ...p,
        originalPrice: Math.round(originalPrice * 100) / 100,
        salePrice: Math.round(salePrice * 100) / 100,
        savingsPercent,
        activePatientsCount: activeMap.get(p.id) ?? 0,
        bestSeller: p.id === bestSellerId,
      };
    });
  }

  /** Totais para o cabeçalho da tela de pacotes. */
  async stats() {
    const [activePackages, distinct] = await Promise.all([
      this.prisma.package.count({ where: { active: true } }),
      this.prisma.patientPackage.findMany({
        where: { status: 'ACTIVE' },
        select: { patientId: true },
        distinct: ['patientId'],
      }),
    ]);
    return {
      activePackages,
      patientsWithPackage: distinct.length,
    };
  }

  async findOne(id: string) {
    const pkg = await this.prisma.package.findUnique({
      where: { id },
      include: {
        ...packageInclude,
        _count: { select: { patientPackages: true } },
      },
    });
    if (!pkg) throw new NotFoundException('Pacote não encontrado');
    return pkg;
  }

  async create(dto: CreatePackageDto, user?: AuditUser) {
    const { items, ...data } = dto;

    // Calcula sessionCount a partir dos items
    const sessionCount = items.reduce((sum, i) => sum + i.quantity, 0);

    const created = await this.prisma.package.create({
      data: {
        ...data,
        sessionCount,
        items: {
          create: items.map((item, idx) => ({
            procedureId: item.procedureId,
            quantity: item.quantity,
            sortOrder: item.sortOrder ?? idx,
          })),
        },
      },
      include: packageInclude,
    });
    this.auditLog.logCreate('Package', created.id, created as unknown as Record<string, unknown>, user).catch(() => undefined);
    return created;
  }

  async update(id: string, dto: UpdatePackageDto, user?: AuditUser) {
    const oldData = await this.findOne(id);
    const { items, ...data } = dto;

    const updated = await this.prisma.$transactionWithRetry(async (tx) => {
      if (items !== undefined) {
        await tx.packageItem.deleteMany({ where: { packageId: id } });
        if (items.length > 0) {
          await tx.packageItem.createMany({
            data: items.map((item: PackageItemDto, idx: number) => ({
              packageId: id,
              procedureId: item.procedureId,
              quantity: item.quantity,
              sortOrder: item.sortOrder ?? idx,
            })),
          });
        }
        // Recalcula sessionCount
        const sessionCount = items.reduce((sum, i) => sum + i.quantity, 0);
        (data as any).sessionCount = sessionCount;
      }

      return tx.package.update({
        where: { id },
        data,
        include: packageInclude,
      });
    });
    this.auditLog.logUpdate('Package', id, oldData as unknown as Record<string, unknown>, updated as unknown as Record<string, unknown>, user).catch(() => undefined);
    return updated;
  }

  async remove(id: string, user?: AuditUser) {
    const pkg = await this.findOne(id);
    // Verifica se há pacotes ativos vinculados a pacientes
    const activeCount = await this.prisma.patientPackage.count({
      where: { packageId: id, status: 'ACTIVE' },
    });
    if (activeCount > 0) {
      throw new BadRequestException(
        `Não é possível excluir: ${activeCount} paciente(s) possui(em) este pacote ativo.`,
      );
    }
    await this.prisma.package.delete({ where: { id } });
    this.auditLog.logDelete('Package', id, pkg as unknown as Record<string, unknown>, user).catch(() => undefined);
    return { ok: true };
  }

  // ─── PatientPackage (venda/vínculo) ───

  async listPatientPackages(patientId?: string) {
    return this.prisma.patientPackage.findMany({
      where: patientId ? { patientId } : undefined,
      orderBy: { purchaseDate: 'desc' },
      include: patientPackageInclude,
    });
  }

  async findPatientPackage(id: string) {
    const pp = await this.prisma.patientPackage.findUnique({
      where: { id },
      include: patientPackageInclude,
    });
    if (!pp) throw new NotFoundException('Pacote do paciente não encontrado');
    return pp;
  }

  async listActiveForPatient(patientId: string) {
    return this.prisma.patientPackage.findMany({
      where: {
        patientId,
        status: 'ACTIVE',
        OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }],
      },
      include: patientPackageInclude,
    });
  }

  /** Preço de catálogo do pacote com a melhor promoção ativa hoje (vinculada ao pacote). */
  async saleQuote(packageId: string) {
    const pkg = await this.findOne(packageId);
    return this.quoteSale(pkg);
  }

  private quoteSale(pkg: Awaited<ReturnType<PackagesService['findOne']>>) {
    return this.promotions.quoteForPackage(
      pkg.id,
      this.resolvePackageSalePrice(pkg),
      toBrazilDateAtUtcNoon(new Date()),
    );
  }

  async createPatientPackage(dto: CreatePatientPackageDto, user?: AuditUser) {
    const pkg = await this.findOne(dto.packageId);
    const quote = await this.quoteSale(pkg);
    const totalPaid = dto.totalPaid ?? quote.finalPrice;
    // Valor acordado manualmente diferente do promocional não leva o nome da promoção
    const promoLabel =
      quote.promotion && Math.abs(totalPaid - quote.finalPrice) < 0.005
        ? ` (Promoção: ${quote.promotion.name} ${this.promotions.discountLabel(quote.promotion)})`
        : '';

    if (dto.paymentMethodId && totalPaid <= 0) {
      throw new BadRequestException(
        'Informe um valor maior que zero para registrar pagamento antecipado.',
      );
    }

    // Calcular expiração
    let expiresAt: Date | null = null;
    if (pkg.validityDays) {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + pkg.validityDays);
    }

    const result = await this.prisma.$transactionWithRetry(async (tx) => {
      const pp = await tx.patientPackage.create({
        data: {
          patientId: dto.patientId,
          packageId: dto.packageId,
          totalPaid,
          notes: dto.notes,
          sessionsTotal: pkg.sessionCount,
          expiresAt,
        },
      });

      if (dto.paymentMethodId) {
        const patient = await tx.patient.findUnique({ where: { id: dto.patientId } });
        const pm = await tx.paymentMethod.findUnique({ where: { id: dto.paymentMethodId } });
        if (!pm) {
          throw new BadRequestException('Forma de pagamento não encontrada.');
        }

        const feePercent = Number(pm.feePercent);
        const netAmount =
          Math.round(totalPaid * (1 - feePercent / 100) * 100) / 100;

        await tx.financialEntry.create({
          data: {
            type: 'INCOME',
            description: `Pacote - ${pkg.name} - ${patient?.name ?? 'Paciente'}${promoLabel}`,
            amount: totalPaid,
            netAmount,
            feePercent,
            paymentMethodId: dto.paymentMethodId,
            category: 'Pacotes',
            paidAt: new Date(),
            patientId: dto.patientId,
            invoiceIssued: false,
          },
        });

        return tx.patientPackage.update({
          where: { id: pp.id },
          data: { financeGenerated: true, paymentMethod: pm.name },
          include: patientPackageInclude,
        });
      }

      return tx.patientPackage.findUniqueOrThrow({
        where: { id: pp.id },
        include: patientPackageInclude,
      });
    });
    this.auditLog.logCreate('PatientPackage', result.id, result as unknown as Record<string, unknown>, user).catch(() => undefined);
    return result;
  }

  /** Preço de venda do catálogo (totalPrice fixo ou soma dos procedimentos com desconto). */
  private resolvePackageSalePrice(pkg: {
    totalPrice: unknown;
    discountPercent: unknown;
    items: { quantity: number; procedure: { price: unknown } }[];
  }): number {
    if (pkg.totalPrice != null) {
      return Number(pkg.totalPrice);
    }
    const sum = pkg.items.reduce(
      (acc, item) => acc + Number(item.procedure.price) * item.quantity,
      0,
    );
    if (pkg.discountPercent != null) {
      return Math.round(sum * (1 - Number(pkg.discountPercent) / 100) * 100) / 100;
    }
    return Math.round(sum * 100) / 100;
  }

  async updatePatientPackage(id: string, dto: UpdatePatientPackageDto, user?: AuditUser) {
    const oldData = await this.findPatientPackage(id);
    const updated = await this.prisma.patientPackage.update({
      where: { id },
      data: dto as any,
      include: patientPackageInclude,
    });
    this.auditLog.logUpdate('PatientPackage', id, oldData as unknown as Record<string, unknown>, updated as unknown as Record<string, unknown>, user).catch(() => undefined);
    return updated;
  }

  // Chamado pelo módulo de appointments ao completar/cancelar agendamento
  async incrementSession(patientPackageId: string) {
    const pp = await this.findPatientPackage(patientPackageId);
    const newUsed = pp.sessionsUsed + 1;
    const isCompleted = newUsed >= pp.sessionsTotal;

    return this.prisma.patientPackage.update({
      where: { id: patientPackageId },
      data: {
        sessionsUsed: newUsed,
        status: isCompleted ? 'COMPLETED' : 'ACTIVE',
      },
    });
  }

  async decrementSession(patientPackageId: string) {
    const pp = await this.findPatientPackage(patientPackageId);
    if (pp.sessionsUsed <= 0) return pp;

    return this.prisma.patientPackage.update({
      where: { id: patientPackageId },
      data: {
        sessionsUsed: pp.sessionsUsed - 1,
        status: 'ACTIVE', // reativa se estava COMPLETED
      },
    });
  }
}
