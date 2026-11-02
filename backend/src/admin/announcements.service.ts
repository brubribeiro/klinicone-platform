import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { AnnouncementStatus, NotificationType, Prisma, type PlatformAnnouncement } from '@prisma/client';

import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { getAppVersion } from '../common/version';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../tenancy/tenant-context';
import type { AnnouncementQueryDto, CreateAnnouncementDto, UpdateAnnouncementDto } from './dto/announcement.dto';
import { recordPlatformAudit } from './platform-audit';
import { parseReleaseNotes, readReleaseNotes } from './release-notes';

const SEND_CHECK_INTERVAL_MS = 60 * 1000;

/** Autor das ações automáticas (rascunho no boot, envio agendado) na auditoria da plataforma. */
export const SYSTEM_ACTOR = {
  id: 'system',
  name: 'Sistema',
  email: 'sistema@plataforma',
} as AuthenticatedUser;

/** Quem recebe: usuários ativos das clínicas ativas (nunca super-admin), salvo quem desligou o tipo. */
export const ANNOUNCEMENT_AUDIENCE: Prisma.UserWhereInput = {
  active: true,
  isSuperAdmin: false,
  tenantId: { not: null },
  tenant: { active: true },
  notificationPreferences: { none: { type: NotificationType.PLATFORM_ANNOUNCEMENT, enabled: false } },
};

const PENDING = [AnnouncementStatus.DRAFT, AnnouncementStatus.SCHEDULED];

const auditTarget = (a: Pick<PlatformAnnouncement, 'title'>) => ({ tenantId: null, name: a.title });

/**
 * Avisos de novidades/correções do super-admin para as clínicas. Rascunhos saem do
 * RELEASE_NOTES.md da versão em VERSION (no boot e no botão "Gerar do release"); o envio
 * cria uma notificação in-app (sino) para cada usuário das clínicas ativas.
 */
@Injectable()
export class AnnouncementsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AnnouncementsService.name);
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    if (process.env.NODE_ENV === 'test') return;
    this.discardObsoleteDraftVersions(['0.2.1']).catch((e) =>
      this.logger.warn(`Rascunhos de versão obsoleta não removidos: ${e instanceof Error ? e.message : e}`),
    );
    this.draftFromRelease(SYSTEM_ACTOR, { onBoot: true }).catch((e) =>
      this.logger.warn(`Rascunho do release não gerado: ${e instanceof Error ? e.message : e}`),
    );
    this.timer = setInterval(
      () => this.sendDue().catch((e) => this.logger.error('Erro ao enviar avisos agendados', e)),
      SEND_CHECK_INTERVAL_MS,
    );
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  list(query: AnnouncementQueryDto = {}) {
    return this.prisma.platformAnnouncement.findMany({
      where: query.status ? { status: query.status } : {},
      orderBy: [{ createdAt: 'desc' }],
    });
  }

  get(id: string) {
    return this.findOrThrow(id);
  }

  /** Quantos receberiam um envio agora (mostrado na confirmação). */
  audience() {
    return TenantContext.runUnscoped(async () => {
      const [users, tenants] = await Promise.all([
        this.prisma.user.count({ where: ANNOUNCEMENT_AUDIENCE }),
        this.prisma.tenant.count({ where: { active: true, users: { some: ANNOUNCEMENT_AUDIENCE } } }),
      ]);
      return { users, tenants };
    });
  }

  /** Apaga rascunhos de versões revertidas no VERSION (não mexe em SCHEDULED/SENT). */
  async discardObsoleteDraftVersions(versions: string[]) {
    if (!versions.length) return { deleted: 0 };
    const { count } = await this.prisma.platformAnnouncement.deleteMany({
      where: { version: { in: versions }, status: AnnouncementStatus.DRAFT },
    });
    if (count) {
      this.logger.log(`Removidos ${count} rascunho(s) de anúncio (${versions.join(', ')})`);
    }
    return { deleted: count };
  }

  /**
   * Cria um rascunho por tipo (novidade/correção) a partir da seção da versão atual no
   * RELEASE_NOTES.md. Tipos que já têm aviso dessa versão ficam como estão (não sobrescreve
   * edições). No boot só roda uma vez por versão: se o rascunho foi excluído, não volta.
   */
  async draftFromRelease(actor: AuthenticatedUser, opts: { onBoot?: boolean } = {}) {
    const markdown = readReleaseNotes();
    if (!markdown) throw new BadRequestException('RELEASE_NOTES.md não encontrado no servidor.');
    const version = getAppVersion();
    const section = parseReleaseNotes(markdown, version);
    if (!section || section.version !== version) {
      throw new BadRequestException(`RELEASE_NOTES.md não tem a seção da versão ${version}.`);
    }

    if (opts.onBoot) {
      const generated = await this.prisma.platformAuditLog.count({
        where: { action: 'ANNOUNCEMENT_GENERATE', details: { path: ['version'], equals: version } },
      });
      if (generated) return { version, created: [], skipped: [] };
    }

    const existing = await this.prisma.platformAnnouncement.findMany({
      where: { version },
      select: { kind: true },
    });
    const existingKinds = new Set(existing.map((a) => a.kind));
    const created: PlatformAnnouncement[] = [];
    for (const draft of section.drafts) {
      if (existingKinds.has(draft.kind)) continue;
      created.push(await this.prisma.platformAnnouncement.create({ data: { ...draft, version } }));
    }
    const skipped = section.drafts.filter((d) => existingKinds.has(d.kind)).map((d) => d.kind);

    if (created.length || opts.onBoot) {
      await recordPlatformAudit(
        this.prisma,
        actor,
        'ANNOUNCEMENT_GENERATE',
        { tenantId: null, name: `Versão ${version}` },
        { version, created: created.map((a) => a.title), skipped },
      );
    }
    return { version, created, skipped };
  }

  async create(dto: CreateAnnouncementDto, actor: AuthenticatedUser) {
    const created = await this.prisma.platformAnnouncement.create({
      data: { title: dto.title, body: dto.body, kind: dto.kind },
    });
    await recordPlatformAudit(this.prisma, actor, 'ANNOUNCEMENT_CREATE', auditTarget(created), {
      announcementId: created.id,
      kind: created.kind,
    });
    return created;
  }

  async update(id: string, dto: UpdateAnnouncementDto, actor: AuthenticatedUser) {
    const current = await this.findPendingOrThrow(id);
    const data: Prisma.PlatformAnnouncementUpdateInput = {};
    const changes: Record<string, unknown> = {};
    if (dto.title !== undefined && dto.title !== current.title) {
      data.title = dto.title;
      changes.title = { old: current.title, new: dto.title };
    }
    if (dto.kind !== undefined && dto.kind !== current.kind) {
      data.kind = dto.kind;
      changes.kind = { old: current.kind, new: dto.kind };
    }
    if (dto.body !== undefined && dto.body !== current.body) {
      data.body = dto.body;
      // O texto inteiro não vai para a auditoria; basta saber que mudou
      changes.bodyChanged = true;
    }
    if (!Object.keys(changes).length) return current;

    const updated = await this.prisma.platformAnnouncement.update({ where: { id }, data });
    await recordPlatformAudit(this.prisma, actor, 'ANNOUNCEMENT_UPDATE', auditTarget(updated), {
      announcementId: id,
      ...changes,
    });
    return updated;
  }

  async remove(id: string, actor: AuthenticatedUser) {
    const current = await this.findPendingOrThrow(id);
    await this.prisma.platformAnnouncement.delete({ where: { id } });
    await recordPlatformAudit(this.prisma, actor, 'ANNOUNCEMENT_DELETE', auditTarget(current), {
      announcementId: id,
      version: current.version,
    });
    return { ok: true };
  }

  async schedule(id: string, scheduledAt: Date, actor: AuthenticatedUser) {
    if (scheduledAt.getTime() <= Date.now()) {
      throw new BadRequestException('Escolha uma data e hora no futuro.');
    }
    await this.findPendingOrThrow(id);
    const updated = await this.prisma.platformAnnouncement.update({
      where: { id },
      data: { status: AnnouncementStatus.SCHEDULED, scheduledAt },
    });
    await recordPlatformAudit(this.prisma, actor, 'ANNOUNCEMENT_SCHEDULE', auditTarget(updated), {
      announcementId: id,
      scheduledAt: scheduledAt.toISOString(),
    });
    return updated;
  }

  async unschedule(id: string, actor: AuthenticatedUser) {
    const current = await this.findOrThrow(id);
    if (current.status !== AnnouncementStatus.SCHEDULED) {
      throw new ConflictException('Este aviso não está agendado.');
    }
    const updated = await this.prisma.platformAnnouncement.update({
      where: { id },
      data: { status: AnnouncementStatus.DRAFT, scheduledAt: null },
    });
    await recordPlatformAudit(this.prisma, actor, 'ANNOUNCEMENT_UNSCHEDULE', auditTarget(updated), {
      announcementId: id,
    });
    return updated;
  }

  send(id: string, actor: AuthenticatedUser) {
    return this.deliver(id, actor, false);
  }

  /** Envia os agendados vencidos (timer de 1 min). */
  async sendDue() {
    const due = await this.prisma.platformAnnouncement.findMany({
      where: { status: AnnouncementStatus.SCHEDULED, scheduledAt: { lte: new Date() } },
      select: { id: true },
    });
    for (const { id } of due) {
      await this.deliver(id, SYSTEM_ACTOR, true).catch((e) => {
        if (!(e instanceof ConflictException)) this.logger.error(`Erro ao enviar o aviso ${id}`, e);
      });
    }
  }

  /**
   * Marca como enviado antes de criar as notificações (updateMany condicional): dois envios
   * simultâneos (botão + timer, ou duas instâncias) não duplicam o aviso no sino.
   */
  private async deliver(id: string, actor: AuthenticatedUser, scheduled: boolean) {
    const before = await this.findOrThrow(id);
    const sentAt = new Date();
    const claimed = await this.prisma.platformAnnouncement.updateMany({
      where: { id, status: { in: PENDING } },
      data: { status: AnnouncementStatus.SENT, sentAt },
    });
    if (!claimed.count) throw new ConflictException('Este aviso já foi enviado.');

    let recipients: { id: string; tenantId: string | null }[];
    try {
      recipients = await TenantContext.runUnscoped(async () => {
        const users = await this.prisma.user.findMany({
          where: ANNOUNCEMENT_AUDIENCE,
          select: { id: true, tenantId: true },
        });
        await this.prisma.notification.createMany({
          data: users.map((u) => ({
            tenantId: u.tenantId!,
            userId: u.id,
            type: NotificationType.PLATFORM_ANNOUNCEMENT,
            title: before.title,
            message: before.body,
            metadata: { announcementId: id, kind: before.kind, version: before.version },
          })),
        });
        return users;
      });
    } catch (e) {
      // Nada foi entregue (createMany é uma instrução só): volta ao estado anterior
      await this.prisma.platformAnnouncement.update({
        where: { id },
        data: { status: before.status, sentAt: null },
      });
      throw e;
    }

    const tenantCount = new Set(recipients.map((u) => u.tenantId)).size;
    const updated = await this.prisma.platformAnnouncement.update({
      where: { id },
      data: { recipientCount: recipients.length },
    });
    await recordPlatformAudit(this.prisma, actor, 'ANNOUNCEMENT_SEND', auditTarget(updated), {
      announcementId: id,
      recipientCount: recipients.length,
      tenantCount,
      ...(scheduled ? { scheduledAt: before.scheduledAt?.toISOString() } : {}),
    });
    return updated;
  }

  private async findOrThrow(id: string) {
    const a = await this.prisma.platformAnnouncement.findUnique({ where: { id } });
    if (!a) throw new NotFoundException('Aviso não encontrado.');
    return a;
  }

  private async findPendingOrThrow(id: string) {
    const a = await this.findOrThrow(id);
    if (a.status === AnnouncementStatus.SENT) throw new ConflictException('Aviso já enviado não pode ser alterado.');
    return a;
  }
}
