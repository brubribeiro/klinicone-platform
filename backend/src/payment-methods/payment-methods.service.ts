import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService, AuditUser } from '../audit-log/audit-log.service';
import { CreatePaymentMethodDto } from './dto/create-payment-method.dto';
import { UpdatePaymentMethodDto } from './dto/update-payment-method.dto';

@Injectable()
export class PaymentMethodsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  list() {
    return this.prisma.paymentMethod.findMany({
      include: { _count: { select: { financialEntries: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const pm = await this.prisma.paymentMethod.findUnique({
      where: { id },
      include: { _count: { select: { financialEntries: true } } },
    });
    if (!pm) throw new NotFoundException('Forma de pagamento não encontrada');
    return pm;
  }

  async create(dto: CreatePaymentMethodDto, user?: AuditUser) {
    const created = await this.prisma.paymentMethod.create({
      data: {
        name: dto.name,
        kind: dto.kind ?? 'OTHER',
        settlementDays: dto.settlementDays ?? 0,
        feePercent: dto.feePercent ?? 0,
        active: dto.active ?? true,
      },
    });
    this.auditLog.logCreate('PaymentMethod', created.id, created as unknown as Record<string, unknown>, user).catch(() => undefined);
    return created;
  }

  async update(id: string, dto: UpdatePaymentMethodDto, user?: AuditUser) {
    const existing = await this.prisma.paymentMethod.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Forma de pagamento não encontrada');
    const updated = await this.prisma.paymentMethod.update({
      where: { id },
      data: {
        name: dto.name,
        kind: dto.kind,
        settlementDays: dto.settlementDays,
        feePercent: dto.feePercent,
        active: dto.active,
      },
    });
    this.auditLog.logUpdate('PaymentMethod', id, existing as unknown as Record<string, unknown>, updated as unknown as Record<string, unknown>, user).catch(() => undefined);
    return updated;
  }

  async remove(id: string, user?: AuditUser) {
    const existing = await this.prisma.paymentMethod.findUnique({
      where: { id },
      include: { _count: { select: { financialEntries: true } } },
    });
    if (!existing) throw new NotFoundException('Forma de pagamento não encontrada');
    if (existing._count.financialEntries > 0) {
      // Não exclui, apenas desativa
      const updated = await this.prisma.paymentMethod.update({
        where: { id },
        data: { active: false },
      });
      this.auditLog.logUpdate('PaymentMethod', id, existing as unknown as Record<string, unknown>, updated as unknown as Record<string, unknown>, user).catch(() => undefined);
      return updated;
    }
    await this.prisma.paymentMethod.delete({ where: { id } });
    this.auditLog.logDelete('PaymentMethod', id, existing as unknown as Record<string, unknown>, user).catch(() => undefined);
    return { ok: true };
  }
}
