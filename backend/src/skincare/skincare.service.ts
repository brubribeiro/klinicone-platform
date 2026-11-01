import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService, AuditUser } from '../audit-log/audit-log.service';
import { SKINCARE_RULE_VALUES, SKINCARE_TAGS_FALLBACK } from './skincare.constants';
import {
  CreateSkincareProductDto,
  CreateSkincareRoutineDto,
  CreateSkincareRuleDto,
  UpdateSkincareProductDto,
  UpdateSkincareRoutineDto,
  UpdateSkincareRuleDto,
} from './dto/skincare.dto';

type AuditRecord = Record<string, unknown>;

function emptyToNull(value: string | null | undefined) {
  if (value === undefined) return undefined;
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

@Injectable()
export class SkincareService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  // ---------- Produtos ----------

  listProducts() {
    return this.prisma.skincareProduct.findMany({ orderBy: [{ createdAt: 'asc' }, { name: 'asc' }] });
  }

  async createProduct(dto: CreateSkincareProductDto, user?: AuditUser) {
    await this.assertSkincareTags(dto.tags);
    const created = await this.prisma.skincareProduct.create({
      data: {
        name: dto.name.trim(),
        brand: emptyToNull(dto.brand),
        activeIngredient: emptyToNull(dto.activeIngredient),
        moments: dto.moments,
        step: dto.step,
        tags: dto.tags ?? [],
        howTo: emptyToNull(dto.howTo),
        note: emptyToNull(dto.note),
      },
    });
    this.auditLog.logCreate('SkincareProduct', created.id, created as unknown as AuditRecord, user).catch(() => undefined);
    return created;
  }

  async updateProduct(id: string, dto: UpdateSkincareProductDto, user?: AuditUser) {
    const existing = await this.prisma.skincareProduct.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Produto não encontrado');
    if (dto.tags !== undefined) await this.assertSkincareTags(dto.tags);
    const updated = await this.prisma.skincareProduct.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        brand: emptyToNull(dto.brand),
        activeIngredient: emptyToNull(dto.activeIngredient),
        moments: dto.moments,
        step: dto.step,
        tags: dto.tags,
        howTo: emptyToNull(dto.howTo),
        note: emptyToNull(dto.note),
      },
    });
    this.auditLog
      .logUpdate('SkincareProduct', id, existing as unknown as AuditRecord, updated as unknown as AuditRecord, user)
      .catch(() => undefined);
    return updated;
  }

  /** Exclui o produto e o retira das regras em que aparece. */
  async removeProduct(id: string, user?: AuditUser) {
    const existing = await this.prisma.skincareProduct.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Produto não encontrado');
    const rules = await this.prisma.skincareRule.findMany({ where: { productIds: { has: id } } });
    await this.prisma.$transaction([
      ...rules.map((r) =>
        this.prisma.skincareRule.update({
          where: { id: r.id },
          data: { productIds: r.productIds.filter((pid) => pid !== id) },
        }),
      ),
      this.prisma.skincareProduct.delete({ where: { id } }),
    ]);
    this.auditLog.logDelete('SkincareProduct', id, existing as unknown as AuditRecord, user).catch(() => undefined);
    return { ok: true };
  }

  // ---------- Regras ----------

  listRules() {
    return this.prisma.skincareRule.findMany({ orderBy: [{ createdAt: 'asc' }] });
  }

  async createRule(dto: CreateSkincareRuleDto, user?: AuditUser) {
    const data = await this.toRuleData(dto);
    const created = await this.prisma.skincareRule.create({ data: data as Prisma.SkincareRuleCreateInput });
    this.auditLog.logCreate('SkincareRule', created.id, created as unknown as AuditRecord, user).catch(() => undefined);
    return created;
  }

  async updateRule(id: string, dto: UpdateSkincareRuleDto, user?: AuditUser) {
    const existing = await this.prisma.skincareRule.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Regra não encontrada');
    const data = await this.toRuleData(dto, existing);
    const updated = await this.prisma.skincareRule.update({ where: { id }, data });
    this.auditLog
      .logUpdate('SkincareRule', id, existing as unknown as AuditRecord, updated as unknown as AuditRecord, user)
      .catch(() => undefined);
    return updated;
  }

  async removeRule(id: string, user?: AuditUser) {
    const existing = await this.prisma.skincareRule.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Regra não encontrada');
    await this.prisma.skincareRule.delete({ where: { id } });
    this.auditLog.logDelete('SkincareRule', id, existing as unknown as AuditRecord, user).catch(() => undefined);
    return { ok: true };
  }

  private async toRuleData(
    dto: UpdateSkincareRuleDto,
    existing?: { field: string; value: string; productIds: string[]; avoidTags: string[] },
  ): Promise<Prisma.SkincareRuleUpdateInput> {
    const field = (dto.field ?? existing?.field) as keyof typeof SKINCARE_RULE_VALUES;
    const value = dto.value ?? existing?.value;
    if (!field || !value || !SKINCARE_RULE_VALUES[field]?.includes(value)) {
      throw new BadRequestException('Critério ou resposta inválidos');
    }
    const productIds = dto.productIds ?? existing?.productIds ?? [];
    const avoidTags = dto.avoidTags ?? existing?.avoidTags ?? [];
    if (productIds.length === 0 && avoidTags.length === 0) {
      throw new BadRequestException('Inclua ao menos um produto ou restrição');
    }
    await this.assertSkincareTags(avoidTags);
    if (dto.productIds?.length) {
      const found = await this.prisma.skincareProduct.count({ where: { id: { in: dto.productIds } } });
      if (found !== new Set(dto.productIds).size) throw new BadRequestException('Produto não encontrado');
    }
    return {
      field,
      value,
      productIds: [...new Set(productIds)],
      avoidTags: [...new Set(avoidTags)],
      note: emptyToNull(dto.note),
    };
  }

  // ---------- Rotinas salvas na ficha ----------

  listRoutines(patientId?: string) {
    return this.prisma.skincareRoutine.findMany({
      where: patientId ? { patientId } : undefined,
      orderBy: [{ consultDate: 'desc' }, { createdAt: 'desc' }],
      include: { patient: { select: { id: true, name: true } } },
    });
  }

  async findRoutine(id: string) {
    const routine = await this.prisma.skincareRoutine.findUnique({
      where: { id },
      include: { patient: { select: { id: true, name: true, phone: true, email: true } } },
    });
    if (!routine) throw new NotFoundException('Rotina não encontrada');
    return routine;
  }

  async createRoutine(dto: CreateSkincareRoutineDto, user?: AuditUser) {
    const patient = await this.prisma.patient.findUnique({ where: { id: dto.patientId }, select: { id: true } });
    if (!patient) throw new NotFoundException('Paciente não encontrado');
    const created = await this.prisma.skincareRoutine.create({
      data: {
        patientId: dto.patientId,
        consultDate: new Date(`${dto.consultDate}T00:00:00Z`),
        answers: dto.answers as Prisma.InputJsonValue,
        items: dto.items as unknown as Prisma.InputJsonValue,
        avoided: (dto.avoided ?? []) as unknown as Prisma.InputJsonValue,
        guidelines: (dto.guidelines ?? []) as unknown as Prisma.InputJsonValue,
        notes: emptyToNull(dto.notes),
        createdById: user?.id ?? null,
        createdByName: user?.name ?? null,
      },
    });
    this.auditLog.logCreate('SkincareRoutine', created.id, created as unknown as AuditRecord, user).catch(() => undefined);
    return this.findRoutine(created.id);
  }

  async updateRoutine(id: string, dto: UpdateSkincareRoutineDto, user?: AuditUser) {
    const existing = await this.prisma.skincareRoutine.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Rotina não encontrada');
    if (dto.patientId && dto.patientId !== existing.patientId) {
      throw new BadRequestException('Não é possível trocar a paciente de uma rotina');
    }
    const updated = await this.prisma.skincareRoutine.update({
      where: { id },
      data: {
        consultDate: dto.consultDate ? new Date(`${dto.consultDate}T00:00:00Z`) : undefined,
        answers: dto.answers as Prisma.InputJsonValue | undefined,
        items: dto.items as unknown as Prisma.InputJsonValue | undefined,
        avoided: dto.avoided as unknown as Prisma.InputJsonValue | undefined,
        guidelines: dto.guidelines as unknown as Prisma.InputJsonValue | undefined,
        notes: emptyToNull(dto.notes),
      },
    });
    this.auditLog
      .logUpdate('SkincareRoutine', id, existing as unknown as AuditRecord, updated as unknown as AuditRecord, user)
      .catch(() => undefined);
    return this.findRoutine(id);
  }

  async removeRoutine(id: string, user?: AuditUser) {
    const existing = await this.prisma.skincareRoutine.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Rotina não encontrada');
    await this.prisma.skincareRoutine.delete({ where: { id } });
    this.auditLog.logDelete('SkincareRoutine', id, existing as unknown as AuditRecord, user).catch(() => undefined);
    return { ok: true };
  }

  private async allowedSkincareTags(): Promise<Set<string>> {
    const rows = await this.prisma.platformCatalogItem.findMany({
      where: { kind: 'skincare_tag', active: true },
      select: { value: true },
    });
    if (rows.length === 0) return new Set(SKINCARE_TAGS_FALLBACK);
    return new Set(rows.map((r) => r.value));
  }

  private async assertSkincareTags(tags: string[] | undefined) {
    if (!tags?.length) return;
    const allowed = await this.allowedSkincareTags();
    const invalid = [...new Set(tags)].filter((t) => !allowed.has(t));
    if (invalid.length) {
      throw new BadRequestException(`Característica inválida ou inativa: ${invalid.join(', ')}`);
    }
  }
}
