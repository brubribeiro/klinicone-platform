import { Injectable, NotFoundException } from '@nestjs/common';
import { IsBoolean, IsNotEmpty, IsOptional, IsString, ValidateIf } from 'class-validator';

import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService, AuditUser } from '../audit-log/audit-log.service';
import { assertDeletable, dependency } from '../common/deletion/deletion-dependencies';

export class CreateDocumentTemplateDto {
  @IsString() @IsNotEmpty()
  name: string;

  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString()
  category?: string | null;

  @IsString() @IsNotEmpty()
  content: string;

  @IsOptional() @IsBoolean()
  active?: boolean;
}

export class UpdateDocumentTemplateDto {
  @IsOptional() @IsString() @IsNotEmpty()
  name?: string;

  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString()
  category?: string | null;

  @IsOptional() @IsString() @IsNotEmpty()
  content?: string;

  @IsOptional() @IsBoolean()
  active?: boolean;
}

@Injectable()
export class DocumentTemplatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  list() {
    return this.prisma.documentTemplate.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { documents: true } } },
    });
  }

  async findOne(id: string) {
    const t = await this.prisma.documentTemplate.findUnique({ where: { id } });
    if (!t) throw new NotFoundException('Modelo não encontrado');
    return t;
  }

  async create(dto: CreateDocumentTemplateDto, user?: AuditUser) {
    const created = await this.prisma.documentTemplate.create({
      data: {
        name: dto.name.trim(),
        category: dto.category || null,
        content: dto.content,
        active: dto.active ?? true,
      },
    });
    this.auditLog
      .logCreate('DocumentTemplate', created.id, created as unknown as Record<string, unknown>, user)
      .catch(() => undefined);
    return created;
  }

  async update(id: string, dto: UpdateDocumentTemplateDto, user?: AuditUser) {
    const before = await this.findOne(id);
    const updated = await this.prisma.documentTemplate.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.category !== undefined ? { category: dto.category || null } : {}),
        ...(dto.content !== undefined ? { content: dto.content } : {}),
        ...(dto.active !== undefined ? { active: dto.active } : {}),
      },
    });
    this.auditLog
      .logUpdate(
        'DocumentTemplate',
        id,
        before as unknown as Record<string, unknown>,
        updated as unknown as Record<string, unknown>,
        user,
      )
      .catch(() => undefined);
    return updated;
  }

  /** Documentos já gerados mantêm o texto; só perdem a referência ao modelo. */
  async remove(id: string, user?: AuditUser, unlink = false) {
    const old = await this.findOne(id);
    const unlinked = await this.prisma.$transactionWithRetry(async (tx) => {
      const documents = await tx.document.findMany({ where: { templateId: id }, select: { name: true } });
      const deps = assertDeletable(
        `o modelo "${old.name}"`,
        [
          dependency({
            type: 'documents',
            label: 'Documentos gerados',
            count: documents.length,
            names: documents.map((d) => d.name),
            unlinkable: true,
            note: 'Os documentos continuam salvos, sem o vínculo com o modelo.',
          }),
        ],
        { unlink },
      );
      await tx.document.updateMany({ where: { templateId: id }, data: { templateId: null } });
      await tx.documentTemplate.delete({ where: { id } });
      return deps;
    });
    this.auditLog
      .logDelete('DocumentTemplate', id, { ...old, unlinkedDependencies: unlinked } as unknown as Record<string, unknown>, user)
      .catch(() => undefined);
    return { ok: true, unlinked };
  }

}
