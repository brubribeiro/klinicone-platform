import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { MeasurementType } from '@prisma/client';

import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../tenancy/tenant-context';
import { CreateMeasurementTypeDto, UpdateMeasurementTypeDto } from './dto/measurement-type.dto';
import { recordPlatformAudit, type PlatformAuditAction } from './platform-audit';

const ORDER_BY = [{ sortOrder: 'asc' as const }, { name: 'asc' as const }];

/**
 * Catálogo global dos tipos de medida corporal (card "Medidas corporais" da ficha).
 * Básicos (peso e altura, `key` preenchida) só podem ser reordenados.
 */
@Injectable()
export class MeasurementTypesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Lista para o painel admin (inclui inativos e quantos valores cada tipo já tem). */
  listForAdmin() {
    return TenantContext.runUnscoped(async () => {
      const types = await this.prisma.measurementType.findMany({
        orderBy: ORDER_BY,
        include: { _count: { select: { values: true } } },
      });
      return types.map(({ _count, ...type }) => ({ ...type, valuesCount: _count.values }));
    });
  }

  /** Leitura do app da clínica: só ativos. */
  listActive() {
    return this.prisma.measurementType.findMany({
      where: { active: true },
      orderBy: ORDER_BY,
      select: { id: true, key: true, name: true, unit: true, sortOrder: true },
    });
  }

  create(dto: CreateMeasurementTypeDto, actor: AuthenticatedUser) {
    return TenantContext.runUnscoped(async () => {
      await this.assertNameFree(dto.name);
      const type = await this.prisma.measurementType.create({
        data: {
          name: dto.name,
          unit: dto.unit,
          sortOrder: dto.sortOrder ?? (await this.nextSortOrder()),
        },
      });
      await this.audit(actor, 'MEASUREMENT_TYPE_CREATE', type, { unit: type.unit, sortOrder: type.sortOrder });
      return type;
    });
  }

  update(id: string, dto: UpdateMeasurementTypeDto, actor: AuthenticatedUser) {
    return TenantContext.runUnscoped(async () => {
      const before = await this.findOrThrow(id);
      if (before.key && ((dto.name && dto.name !== before.name) || (dto.unit && dto.unit !== before.unit))) {
        throw new BadRequestException('Peso e altura são medidas básicas: só a ordem pode mudar.');
      }
      if (dto.name && dto.name !== before.name) await this.assertNameFree(dto.name, id);

      const updated = await this.prisma.measurementType.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.unit !== undefined ? { unit: dto.unit } : {}),
          ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
        },
      });

      const changes: Record<string, { old: unknown; new: unknown }> = {};
      for (const key of ['name', 'unit', 'sortOrder'] as const) {
        if (before[key] !== updated[key]) changes[key] = { old: before[key], new: updated[key] };
      }
      if (Object.keys(changes).length) await this.audit(actor, 'MEASUREMENT_TYPE_UPDATE', updated, changes);
      return updated;
    });
  }

  reorder(ids: string[], actor: AuthenticatedUser) {
    return TenantContext.runUnscoped(async () => {
      const types = await this.prisma.measurementType.findMany({ orderBy: ORDER_BY });
      const known = new Set(types.map((t) => t.id));
      if (new Set(ids).size !== ids.length || ids.length !== types.length || ids.some((id) => !known.has(id))) {
        throw new BadRequestException('Envie todos os tipos de medida, cada um uma vez.');
      }
      await this.prisma.$transaction(
        ids.map((id, sortOrder) => this.prisma.measurementType.update({ where: { id }, data: { sortOrder } })),
      );
      await recordPlatformAudit(
        this.prisma,
        actor,
        'MEASUREMENT_TYPE_REORDER',
        { tenantId: null, name: 'Tipos de medida' },
        { old: types.map((t) => t.name), new: ids.map((id) => types.find((t) => t.id === id)!.name) },
      );
      return this.listForAdmin();
    });
  }

  setActive(id: string, active: boolean, actor: AuthenticatedUser) {
    return TenantContext.runUnscoped(async () => {
      const type = await this.findOrThrow(id);
      if (type.active === active) return type;
      if (type.key && !active) throw new BadRequestException('Peso e altura são medidas básicas e não podem ser desativadas.');
      const updated = await this.prisma.measurementType.update({ where: { id }, data: { active } });
      await this.audit(actor, active ? 'MEASUREMENT_TYPE_ACTIVATE' : 'MEASUREMENT_TYPE_DEACTIVATE', updated);
      return updated;
    });
  }

  /** Só tipos sem valores registrados; com histórico, desative (os valores continuam visíveis na ficha). */
  remove(id: string, actor: AuthenticatedUser) {
    return TenantContext.runUnscoped(async () => {
      const type = await this.findOrThrow(id);
      if (type.key) throw new BadRequestException('Peso e altura são medidas básicas e não podem ser excluídas.');
      const values = await this.prisma.patientMeasurementValue.count({ where: { typeId: id } });
      if (values > 0) {
        throw new ConflictException(
          `“${type.name}” já tem ${values} ${values === 1 ? 'valor registrado' : 'valores registrados'}: desative em vez de excluir.`,
        );
      }
      await this.prisma.measurementType.delete({ where: { id } });
      await this.audit(actor, 'MEASUREMENT_TYPE_DELETE', type);
      return { ok: true };
    });
  }

  private async nextSortOrder() {
    const last = await this.prisma.measurementType.findFirst({
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });
    return (last?.sortOrder ?? -1) + 1;
  }

  private async findOrThrow(id: string): Promise<MeasurementType> {
    const type = await this.prisma.measurementType.findUnique({ where: { id } });
    if (!type) throw new NotFoundException('Tipo de medida não encontrado.');
    return type;
  }

  private async assertNameFree(name: string, exceptId?: string) {
    const existing = await this.prisma.measurementType.findFirst({
      where: { name: { equals: name, mode: 'insensitive' }, ...(exceptId ? { id: { not: exceptId } } : {}) },
    });
    if (existing) throw new ConflictException(`Já existe a medida “${existing.name}”.`);
  }

  private audit(
    actor: AuthenticatedUser,
    action: Extract<PlatformAuditAction, `MEASUREMENT_TYPE_${string}`>,
    type: MeasurementType,
    details?: Record<string, unknown>,
  ) {
    return recordPlatformAudit(
      this.prisma,
      actor,
      action,
      { tenantId: null, name: `Medida: ${type.name}` },
      { measurementTypeId: type.id, name: type.name, ...details },
    );
  }
}
