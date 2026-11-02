import { createHash, randomBytes } from 'node:crypto';
import { BadRequestException, GoneException, Injectable, NotFoundException } from '@nestjs/common';
import { AnamnesisKind, AnamnesisQuestion, AnamnesisQuestionType, Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService, AuditUser } from '../audit-log/audit-log.service';
import { PatientMeasurementsService } from '../patients/patient-measurements.service';
import { TenantContext } from '../tenancy/tenant-context';
import { ANAMNESIS_LINK_TTL_DAYS, DEFAULT_QUESTIONS } from './anamnesis.constants';
import {
  CreateAnamnesisQuestionDto,
  ReorderAnamnesisQuestionsDto,
  UpdateAnamnesisQuestionDto,
} from './dto/anamnesis.dto';

type AuditRecord = Record<string, unknown>;

const CHOICE_TYPES: AnamnesisQuestionType[] = [AnamnesisQuestionType.SINGLE_CHOICE, AnamnesisQuestionType.MULTIPLE_CHOICE];
const MAX_TEXT_ANSWER = 2000;

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

function emptyToNull(value: string | null | undefined) {
  if (value === undefined) return undefined;
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function cleanOptions(options: string[] | undefined) {
  if (options === undefined) return undefined;
  return [...new Set(options.map((o) => o.trim()).filter(Boolean))];
}

/** "Usa óculos?" -> "usaOculos" (chave das respostas salvas). */
export function questionKeyFromLabel(label: string) {
  const words = label
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .slice(0, 6);
  const key = words.map((w, i) => (i === 0 ? w : w[0].toUpperCase() + w.slice(1))).join('');
  return (key || 'pergunta').slice(0, 40);
}

/**
 * Valida as respostas contra as perguntas ativas: ignora chaves desconhecidas, converte tipos
 * e recusa obrigatória em branco. Devolve só as respostas preenchidas.
 */
export function normalizeAnswers(questions: AnamnesisQuestion[], input: Record<string, unknown>) {
  const answers: Record<string, string | number | boolean | string[]> = {};
  const missing: string[] = [];

  for (const q of questions) {
    const raw = input[q.key];
    let value: string | number | boolean | string[] | null = null;

    if (q.type === AnamnesisQuestionType.BOOLEAN) {
      if (typeof raw === 'boolean') value = raw;
    } else if (q.type === AnamnesisQuestionType.NUMBER) {
      const n = typeof raw === 'number' ? raw : parseFloat(String(raw ?? '').replace(',', '.'));
      if (Number.isFinite(n)) {
        if (n < 0 || n > 100000) throw new BadRequestException(`Valor inválido em "${q.label}".`);
        value = n;
      }
    } else if (q.type === AnamnesisQuestionType.MULTIPLE_CHOICE) {
      const list = Array.isArray(raw) ? raw.filter((v): v is string => typeof v === 'string') : [];
      if (list.some((v) => !q.options.includes(v))) throw new BadRequestException(`Opção inválida em "${q.label}".`);
      if (list.length) value = [...new Set(list)];
    } else if (q.type === AnamnesisQuestionType.SINGLE_CHOICE) {
      if (typeof raw === 'string' && raw) {
        if (!q.options.includes(raw)) throw new BadRequestException(`Opção inválida em "${q.label}".`);
        value = raw;
      }
    } else if (typeof raw === 'string' && raw.trim()) {
      value = raw.trim().slice(0, MAX_TEXT_ANSWER);
    }

    if (value === null) {
      if (q.required) missing.push(q.label);
      continue;
    }
    answers[q.key] = value;
  }

  if (missing.length) {
    throw new BadRequestException(`Responda as perguntas obrigatórias: ${missing.join(', ')}.`);
  }
  return answers;
}

@Injectable()
export class AnamnesisService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly measurements: PatientMeasurementsService,
  ) {}

  // ---------- Perguntas ----------

  async listQuestions(kind: AnamnesisKind) {
    await this.ensureDefaults(kind);
    return this.prisma.anamnesisQuestion.findMany({
      where: { kind },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  /** Primeira leitura da clínica: cria as perguntas iniciais (seed por clínica). */
  private async ensureDefaults(kind: AnamnesisKind) {
    const count = await this.prisma.anamnesisQuestion.count({ where: { kind } });
    if (count > 0) return;
    await this.prisma.anamnesisQuestion.createMany({
      data: DEFAULT_QUESTIONS[kind].map((q, i) => ({
        kind,
        key: q.key,
        label: q.label,
        type: q.type,
        options: q.options ?? [],
        section: q.section ?? null,
        placeholder: q.placeholder ?? null,
        active: q.active ?? true,
        system: q.system ?? false,
        sortOrder: i,
      })),
      skipDuplicates: true,
    });
  }

  async createQuestion(dto: CreateAnamnesisQuestionDto, user?: AuditUser) {
    const questions = await this.listQuestions(dto.kind);
    const options = cleanOptions(dto.options) ?? [];
    this.assertOptions(dto.type, options);

    const base = questionKeyFromLabel(dto.label);
    const used = new Set(questions.map((q) => q.key));
    let key = base;
    for (let n = 2; used.has(key); n++) key = `${base}${n}`;

    const created = await this.prisma.anamnesisQuestion.create({
      data: {
        kind: dto.kind,
        key,
        label: dto.label.trim(),
        type: dto.type,
        options: CHOICE_TYPES.includes(dto.type) ? options : [],
        section: emptyToNull(dto.section) ?? null,
        placeholder: emptyToNull(dto.placeholder) ?? null,
        required: dto.required ?? false,
        active: dto.active ?? true,
        sortOrder: questions.reduce((max, q) => Math.max(max, q.sortOrder), -1) + 1,
      },
    });
    this.auditLog.logCreate('AnamnesisQuestion', created.id, created as unknown as AuditRecord, user).catch(() => undefined);
    return created;
  }

  /**
   * A chave e o tipo de anamnese não mudam (respostas salvas dependem deles). Pergunta do sistema
   * só tem texto, dica, seção e ordem editáveis.
   */
  async updateQuestion(id: string, dto: UpdateAnamnesisQuestionDto, user?: AuditUser) {
    const existing = await this.prisma.anamnesisQuestion.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Pergunta não encontrada');

    const data: Prisma.AnamnesisQuestionUpdateInput = {
      label: dto.label?.trim(),
      section: emptyToNull(dto.section),
      placeholder: emptyToNull(dto.placeholder),
      sortOrder: dto.sortOrder,
    };
    if (existing.system) {
      const locked = dto.type !== undefined && dto.type !== existing.type;
      if (locked || dto.options !== undefined || dto.active === false || dto.required !== undefined) {
        throw new BadRequestException('Esta pergunta é usada pelo sistema: só o texto e a ordem podem mudar.');
      }
    } else {
      const type = dto.type ?? existing.type;
      const options = cleanOptions(dto.options) ?? existing.options;
      this.assertOptions(type, options);
      data.type = type;
      data.options = CHOICE_TYPES.includes(type) ? options : [];
      data.required = dto.required;
      data.active = dto.active;
    }

    const updated = await this.prisma.anamnesisQuestion.update({ where: { id }, data });
    this.auditLog
      .logUpdate('AnamnesisQuestion', id, existing as unknown as AuditRecord, updated as unknown as AuditRecord, user)
      .catch(() => undefined);
    return updated;
  }

  async reorderQuestions(dto: ReorderAnamnesisQuestionsDto) {
    const questions = await this.prisma.anamnesisQuestion.findMany({ where: { kind: dto.kind }, select: { id: true } });
    const known = new Set(questions.map((q) => q.id));
    if (dto.ids.some((id) => !known.has(id))) throw new BadRequestException('Pergunta não encontrada');
    await this.prisma.$transactionWithRetry(async (tx) => {
      for (const [sortOrder, id] of dto.ids.entries()) {
        await tx.anamnesisQuestion.update({ where: { id }, data: { sortOrder } });
      }
    });
    return this.listQuestions(dto.kind);
  }

  private assertOptions(type: AnamnesisQuestionType, options: string[]) {
    if (CHOICE_TYPES.includes(type) && options.length < 2) {
      throw new BadRequestException('Informe pelo menos duas opções para perguntas de escolha.');
    }
  }

  // ---------- Link para a paciente ----------

  /** Gera um link novo e revoga os anteriores ainda abertos da mesma paciente. */
  async createLink(patientId: string, user?: AuditUser) {
    const patient = await this.prisma.patient.findUnique({ where: { id: patientId }, select: { id: true } });
    if (!patient) throw new NotFoundException('Paciente não encontrada');

    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + ANAMNESIS_LINK_TTL_DAYS * 24 * 60 * 60 * 1000);
    const now = new Date();
    const link = await this.prisma.$transactionWithRetry(async (tx) => {
      await tx.anamnesisLink.updateMany({
        where: { patientId, usedAt: null, revokedAt: null },
        data: { revokedAt: now },
      });
      return tx.anamnesisLink.create({
        data: { patientId, tokenHash: hashToken(token), expiresAt, createdById: user?.id ?? null },
      });
    });
    this.auditLog
      .logCreate('AnamnesisLink', link.id, { patientId, expiresAt: link.expiresAt }, user)
      .catch(() => undefined);
    return { token, expiresAt: link.expiresAt };
  }

  /** Só aqui a consulta roda sem clínica: o token é que diz de qual clínica e paciente é o link. */
  private async resolveToken(token: string) {
    const link = await TenantContext.runUnscoped(() =>
      this.prisma.anamnesisLink.findUnique({ where: { tokenHash: hashToken(token) } }),
    );
    if (!link || link.revokedAt) throw new NotFoundException('Link inválido. Peça um novo link à clínica.');
    if (link.usedAt) throw new GoneException('Esta anamnese já foi enviada. Obrigada!');
    if (link.expiresAt.getTime() < Date.now()) throw new GoneException('Este link expirou. Peça um novo link à clínica.');
    return link;
  }

  private async activeGeneralQuestions() {
    const questions = await this.listQuestions(AnamnesisKind.GENERAL);
    return questions.filter((q) => q.active);
  }

  async getPublicForm(token: string) {
    const link = await this.resolveToken(token);
    return TenantContext.run(link.tenantId, async () => {
      const [patient, tenant, questions] = await Promise.all([
        this.prisma.patient.findUnique({ where: { id: link.patientId }, select: { name: true } }),
        this.prisma.tenant.findUnique({ where: { id: link.tenantId }, select: { name: true } }),
        this.activeGeneralQuestions(),
      ]);
      if (!patient) throw new NotFoundException('Link inválido. Peça um novo link à clínica.');
      return {
        firstName: patient.name.trim().split(/\s+/)[0],
        clinicName: tenant?.name ?? null,
        expiresAt: link.expiresAt,
        questions: questions.map((q) => ({
          key: q.key,
          label: q.label,
          type: q.type,
          options: q.options,
          section: q.section,
          placeholder: q.placeholder,
          required: q.required,
        })),
      };
    });
  }

  /** Grava as respostas por cima da anamnese atual (perguntas não respondidas ficam como estavam). */
  async submitPublic(token: string, input: Record<string, unknown>) {
    const link = await this.resolveToken(token);
    return TenantContext.run(link.tenantId, async () => {
      const answers = normalizeAnswers(await this.activeGeneralQuestions(), input);

      // Marca o uso antes de gravar: dois envios simultâneos não passam os dois.
      const claimed = await this.prisma.anamnesisLink.updateMany({
        where: { id: link.id, usedAt: null, revokedAt: null },
        data: { usedAt: new Date() },
      });
      if (claimed.count === 0) throw new GoneException('Esta anamnese já foi enviada. Obrigada!');

      try {
        const patient = await this.prisma.patient.findUnique({ where: { id: link.patientId } });
        if (!patient) throw new NotFoundException('Paciente não encontrada');
        const before = (patient.anamnesis ?? {}) as Record<string, unknown>;
        const after = { ...before, ...answers };
        await this.prisma.patient.update({
          where: { id: patient.id },
          data: { anamnesis: after as Prisma.InputJsonValue },
        });
        await this.measurements.recordFromAnamnesis(patient.id, before, after);
        this.auditLog
          .logUpdate('Patient', patient.id, { anamnesis: before }, { anamnesis: after })
          .catch(() => undefined);
      } catch (err) {
        await this.prisma.anamnesisLink.update({ where: { id: link.id }, data: { usedAt: null } });
        throw err;
      }
      return { ok: true };
    });
  }
}
