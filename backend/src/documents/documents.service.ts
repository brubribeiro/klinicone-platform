import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DocumentStatus, Prisma } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUUID, ValidateIf } from 'class-validator';

import { PrismaService } from '../prisma/prisma.service';
import { R2StorageService } from './r2-storage.service';
import { CompressionService } from './compression.service';
import { AuditLogService, AuditUser } from '../audit-log/audit-log.service';
import { assertAllowedFileContent } from '../common/utils/file-magic.util';
import { DOCUMENT_ALLOWED_MIMES } from './upload-allowlist';
import { PlanLimitsService } from '../plan-limits/plan-limits.service';

export class CreateDocumentDto {
  @IsString()
  name: string;

  @IsOptional() @IsString()
  category?: string;

  @IsOptional() @IsString()
  notes?: string;

  @IsOptional() @IsUUID()
  patientId?: string;

  @IsOptional() @IsUUID()
  equipmentId?: string;

  @IsOptional() @IsEnum(DocumentStatus)
  status?: DocumentStatus;
}

export class CreateFromTemplateDto {
  @IsUUID()
  templateId: string;

  @IsOptional() @IsString()
  name?: string;

  @IsOptional() @IsString()
  category?: string;

  @IsOptional() @IsString()
  notes?: string;

  @IsOptional() @IsUUID()
  patientId?: string;

  @IsOptional() @IsUUID()
  equipmentId?: string;

  @IsOptional() @IsEnum(DocumentStatus)
  status?: DocumentStatus;
}

export class UpdateDocumentDto {
  @IsOptional() @IsString()
  name?: string;

  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString()
  category?: string | null;

  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString()
  notes?: string | null;

  @IsOptional() @ValidateIf((_, v) => v !== null) @IsUUID()
  patientId?: string | null;

  @IsOptional() @ValidateIf((_, v) => v !== null) @IsUUID()
  equipmentId?: string | null;

  @IsOptional() @IsEnum(DocumentStatus)
  status?: DocumentStatus;
}

const DOC_INCLUDE = {
  patient: { select: { id: true, name: true } },
  equipment: { select: { id: true, name: true } },
  template: { select: { id: true, name: true } },
} satisfies Prisma.DocumentInclude;

/** Detalhe: inclui o contato do paciente para "Enviar ao paciente". */
const DOC_DETAIL_INCLUDE = {
  ...DOC_INCLUDE,
  patient: { select: { id: true, name: true, phone: true, email: true } },
} satisfies Prisma.DocumentInclude;

const TZ = 'America/Sao_Paulo';

function fmtDate(value: Date, timeZone = TZ) {
  return new Intl.DateTimeFormat('pt-BR', { timeZone, day: '2-digit', month: '2-digit', year: 'numeric' }).format(value);
}

function fmtCpf(value?: string | null) {
  if (!value) return '';
  const digits = value.replace(/\D/g, '');
  return digits.length === 11 ? digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : value;
}

function slug(value: string) {
  return value.replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, '-').toLowerCase();
}

/** signedAt acompanha o status: preenchido ao virar Assinado, limpo ao sair dele. */
function statusData(status: DocumentStatus | undefined, current?: { status: DocumentStatus; signedAt: Date | null }) {
  if (!status) return {};
  if (status !== DocumentStatus.SIGNED) return { status, signedAt: null };
  return { status, signedAt: current?.status === DocumentStatus.SIGNED ? current.signedAt : new Date() };
}

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly r2: R2StorageService,
    private readonly compression: CompressionService,
    private readonly auditLog: AuditLogService,
    private readonly planLimits: PlanLimitsService,
  ) {}

  /** Lista sem o texto gerado (pode ser longo); `hasContent` indica se há texto para visualizar. */
  async list(filter?: { patientId?: string; equipmentId?: string }) {
    const docs = await this.prisma.document.findMany({
      where: {
        ...(filter?.patientId ? { patientId: filter.patientId } : {}),
        ...(filter?.equipmentId ? { equipmentId: filter.equipmentId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: DOC_INCLUDE,
    });
    return docs.map((d) => this.withoutContent(d));
  }

  async findOne(id: string) {
    const d = await this.prisma.document.findUnique({
      where: { id },
      include: DOC_DETAIL_INCLUDE,
    });
    if (!d) throw new NotFoundException('Documento não encontrado');
    // Resposta ao cliente: nunca devolver fileUrl pública persistida (usar getAccessUrl).
    return this.withoutFileUrl(d);
  }

  /** Interno: registro completo (auditoria / replace de arquivo). */
  private async findOneRaw(id: string) {
    const d = await this.prisma.document.findUnique({
      where: { id },
      include: DOC_INCLUDE,
    });
    if (!d) throw new NotFoundException('Documento não encontrado');
    return d;
  }

  /** Não expoe URL pública durável — acesso só via presign (`getAccessUrl`). */
  private withoutFileUrl<T extends { fileUrl?: string | null }>(doc: T): T {
    return { ...doc, fileUrl: null };
  }

  private withoutContent<T extends { content: string | null; fileUrl?: string | null }>({
    content,
    fileUrl: _fileUrl,
    ...d
  }: T) {
    return { ...d, fileUrl: null, hasContent: !!content };
  }

  /** Gera um documento a partir de um modelo, substituindo os placeholders pelos dados do paciente. */
  async createFromTemplate(dto: CreateFromTemplateDto, user?: AuditUser) {
    const template = await this.prisma.documentTemplate.findUnique({ where: { id: dto.templateId } });
    if (!template) throw new NotFoundException('Modelo não encontrado');

    const patient = dto.patientId
      ? await this.prisma.patient.findUnique({ where: { id: dto.patientId } })
      : null;
    if (dto.patientId && !patient) throw new NotFoundException('Paciente não encontrado');

    const values: Record<string, string> = {
      paciente: patient?.name ?? '',
      cpf: fmtCpf(patient?.document),
      nascimento: patient?.birthDate ? fmtDate(patient.birthDate, 'UTC') : '',
      telefone: patient?.phone ?? '',
      email: patient?.email ?? '',
      endereco: patient?.address ?? '',
      data: fmtDate(new Date()),
      profissional: user?.name ?? '',
    };
    const content = template.content.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key: string) =>
      key in values ? values[key] : match,
    );

    const created = await this.prisma.document.create({
      data: {
        name: dto.name?.trim() || (patient ? `${template.name} — ${patient.name}` : template.name),
        category: dto.category ?? template.category,
        notes: dto.notes,
        content,
        templateId: template.id,
        patientId: dto.patientId,
        equipmentId: dto.equipmentId,
        ...statusData(dto.status ?? DocumentStatus.PENDING),
      },
      include: DOC_INCLUDE,
    });

    this.auditLog
      .logCreate('Document', created.id, created as unknown as Record<string, unknown>, user)
      .catch(() => undefined);

    return this.withoutContent(created);
  }

  async update(id: string, dto: UpdateDocumentDto, user?: AuditUser) {
    const before = await this.findOneRaw(id);
    const updated = await this.prisma.document.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() || before.name } : {}),
        ...(dto.category !== undefined ? { category: dto.category || null } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes || null } : {}),
        ...(dto.patientId !== undefined ? { patientId: dto.patientId } : {}),
        ...(dto.equipmentId !== undefined ? { equipmentId: dto.equipmentId } : {}),
        ...statusData(dto.status, before),
      },
      include: DOC_INCLUDE,
    });

    this.auditLog
      .logUpdate(
        'Document',
        id,
        before as unknown as Record<string, unknown>,
        updated as unknown as Record<string, unknown>,
        user,
      )
      .catch(() => undefined);

    return this.withoutContent(updated);
  }

  /** Anexa (ou substitui) o arquivo de um documento existente — ex.: versão assinada de um termo gerado. */
  async attachFile(id: string, file: Express.Multer.File, user?: AuditUser) {
    if (!this.r2.isConfigured) {
      throw new BadRequestException('Cloudflare R2 não está configurado. Verifique as variáveis de ambiente.');
    }
    const before = await this.findOneRaw(id);
    const mimeType = assertAllowedFileContent(file.buffer, file.mimetype, DOCUMENT_ALLOWED_MIMES);
    const compressed = await this.compression.compress(file.buffer, mimeType);
    await this.planLimits.assertStorageAvailable(compressed.compressedSize, before.storageKey ? (before.size ?? 0) : 0);
    const subfolder = before.patient
      ? `pacientes/${slug(before.patient.name)}`
      : before.equipment
        ? `equipamentos/${slug(before.equipment.name)}`
        : undefined;
    const { key } = await this.r2.upload(before.name, compressed.mimeType, compressed.buffer, subfolder);

    const updated = await this.prisma.document.update({
      where: { id },
      data: {
        storageKey: key,
        fileUrl: null,
        mimeType: compressed.mimeType,
        size: compressed.compressedSize,
        ...statusData(DocumentStatus.SIGNED, before),
      },
      include: DOC_INCLUDE,
    });
    if (before.storageKey) {
      await this.r2.remove(before.storageKey).catch(() => undefined);
    }

    this.auditLog
      .logUpdate(
        'Document',
        id,
        before as unknown as Record<string, unknown>,
        updated as unknown as Record<string, unknown>,
        user,
      )
      .catch(() => undefined);

    return this.withoutContent(updated);
  }

  /** URL temporária assinada para arquivo privado no R2. */
  async getAccessUrl(id: string): Promise<{ url: string }> {
    const doc = await this.findOneRaw(id);

    if (!doc.storageKey) {
      throw new NotFoundException('Arquivo não disponível para visualização.');
    }
    if (!this.r2.isConfigured) {
      throw new BadRequestException('Cloudflare R2 não está configurado.');
    }

    const url = await this.r2.getPresignedUrl(doc.storageKey);
    return { url };
  }

  /** Upload de arquivo: envia para o Cloudflare R2 e salva referência no banco */
  async upload(dto: CreateDocumentDto, file: Express.Multer.File, user?: AuditUser) {
    if (!this.r2.isConfigured) {
      throw new BadRequestException('Cloudflare R2 não está configurado. Verifique as variáveis de ambiente.');
    }

    // Subfolder baseado no vínculo
    let subfolder: string | undefined;
    if (dto.patientId) {
      const patient = await this.prisma.patient.findUnique({
        where: { id: dto.patientId },
        select: { name: true },
      });
      if (patient) subfolder = `pacientes/${slug(patient.name)}`;
    } else if (dto.equipmentId) {
      const equip = await this.prisma.equipment.findUnique({
        where: { id: dto.equipmentId },
        select: { name: true },
      });
      if (equip) subfolder = `equipamentos/${slug(equip.name)}`;
    }

    const mimeType = assertAllowedFileContent(file.buffer, file.mimetype, DOCUMENT_ALLOWED_MIMES);
    const compressed = await this.compression.compress(file.buffer, mimeType);
    await this.planLimits.assertStorageAvailable(compressed.compressedSize);

    const { key } = await this.r2.upload(
      dto.name || file.originalname,
      compressed.mimeType,
      compressed.buffer,
      subfolder,
    );

    const created = await this.prisma.document.create({
      data: {
        name: dto.name || file.originalname,
        category: dto.category,
        notes: dto.notes,
        storageKey: key,
        fileUrl: null,
        mimeType: compressed.mimeType,
        size: compressed.compressedSize,
        patientId: dto.patientId,
        equipmentId: dto.equipmentId,
        // Arquivo enviado sem status explícito é tratado como versão final
        ...statusData(dto.status ?? DocumentStatus.SIGNED),
      },
      include: DOC_INCLUDE,
    });

    this.auditLog
      .logCreate('Document', created.id, created as unknown as Record<string, unknown>, user)
      .catch(() => undefined);

    return this.withoutContent(created);
  }

  async remove(id: string, user?: AuditUser) {
    const d = await this.findOneRaw(id);
    if (d.storageKey) {
      await this.r2.remove(d.storageKey);
    }
    await this.prisma.document.delete({ where: { id } });
    this.auditLog.logDelete('Document', id, d as unknown as Record<string, unknown>, user).catch(() => undefined);
    return { ok: true };
  }
}
