import { Injectable, NotFoundException } from '@nestjs/common';
import { FeedbackStatus, FeedbackType, NotificationType, Prisma } from '@prisma/client';

import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { SYSTEM_ADMIN_ROLE_NAME } from '../common/permissions';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../tenancy/tenant-context';
import { parseUsageRange } from './usage.service';
import type { FeedbackAdminQueryDto } from './dto/feedback-admin.dto';
import { recordPlatformAudit } from './platform-audit';

const FEEDBACK_TYPE_LABEL: Record<FeedbackType, string> = {
  BUG: 'Bug',
  SUGGESTION: 'Sugestão',
};

const LIST_SELECT = {
  id: true,
  type: true,
  status: true,
  title: true,
  pageUrl: true,
  createdAt: true,
  statusChangedAt: true,
  tenant: { select: { id: true, name: true } },
  user: { select: { id: true, name: true, email: true } },
} as const;

/**
 * Central de reports do super-admin: bugs e sugestões de todas as clínicas.
 * A lista da clínica (Configurações → Feedback) continua em FeedbackService, com escopo.
 */
@Injectable()
export class FeedbackAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  list(query: FeedbackAdminQueryDto) {
    const page = Math.max(query.page ?? 1, 1);
    const limit = Math.min(Math.max(query.limit ?? 25, 1), 100);
    // Só "to": desde o início (no uso, "from" vazio vira o mês corrente)
    const range = query.from || query.to ? parseUsageRange(query.from ?? '2000-01-01', query.to) : null;
    const search = query.search?.trim();
    const where: Prisma.FeedbackReportWhereInput = {
      ...(query.tenantId ? { tenantId: query.tenantId } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(range ? { createdAt: { gte: range.gte, lt: range.lt } } : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    // Contadores por status ignoram o próprio filtro de status (abas da tela)
    const { status: _status, ...countWhere } = where;

    return TenantContext.runUnscoped(async () => {
      const [data, total, byStatus] = await Promise.all([
        this.prisma.feedbackReport.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
          select: LIST_SELECT,
        }),
        this.prisma.feedbackReport.count({ where }),
        this.prisma.feedbackReport.groupBy({ by: ['status'], where: countWhere, _count: { _all: true } }),
      ]);
      const counts = { OPEN: 0, TRIAGED: 0, CLOSED: 0 } as Record<FeedbackStatus, number>;
      for (const row of byStatus) counts[row.status] = row._count._all;
      return { data, total, page, limit, totalPages: Math.ceil(total / limit), counts };
    });
  }

  get(id: string) {
    return TenantContext.runUnscoped(() => this.findOrThrow(id));
  }

  setStatus(id: string, status: FeedbackStatus, actor: AuthenticatedUser) {
    return TenantContext.runUnscoped(async () => {
      const report = await this.findOrThrow(id);
      if (report.status === status) return report;
      const updated = await this.prisma.feedbackReport.update({
        where: { id },
        data: { status, statusChangedAt: new Date() },
        select: { ...LIST_SELECT, description: true },
      });
      await recordPlatformAudit(
        this.prisma,
        actor,
        'FEEDBACK_STATUS_CHANGE',
        { tenantId: report.tenant.id, name: report.tenant.name },
        { feedbackId: report.id, type: report.type, title: report.title, old: report.status, new: status },
      );
      if (status === FeedbackStatus.CLOSED) {
        this.notifyClinicFeedbackClosed(report).catch(() => undefined);
      }
      return updated;
    });
  }

  /** Quem reportou (se ativo); senão admins da clínica. */
  private async notifyClinicFeedbackClosed(report: {
    id: string;
    type: FeedbackType;
    title: string;
    pageUrl: string | null;
    tenant: { id: string };
    user: { id: string };
  }) {
    const tenantId = report.tenant.id;
    const typeLabel = FEEDBACK_TYPE_LABEL[report.type];
    const link =
      report.pageUrl && report.pageUrl.startsWith('/') ? report.pageUrl : undefined;

    await TenantContext.run(tenantId, async () => {
      const reporter = await this.prisma.user.findUnique({
        where: { id: report.user.id },
        select: { id: true, active: true },
      });
      let userIds: string[];
      if (reporter?.active) {
        userIds = [reporter.id];
      } else {
        const admins = await this.prisma.user.findMany({
          where: {
            active: true,
            role: { name: SYSTEM_ADMIN_ROLE_NAME },
          },
          select: { id: true },
        });
        userIds = admins.map((a) => a.id);
      }
      if (!userIds.length) return;

      await this.notifications.notifyMany(userIds, {
        type: NotificationType.FEEDBACK_CLOSED,
        title: `${typeLabel} concluído`,
        message: `"${report.title}" foi finalizado pela equipe da plataforma.`,
        link,
        metadata: { feedbackId: report.id, feedbackType: report.type },
      });
    });
  }

  private async findOrThrow(id: string) {
    const report = await this.prisma.feedbackReport.findUnique({
      where: { id },
      select: { ...LIST_SELECT, description: true },
    });
    if (!report) throw new NotFoundException('Report não encontrado.');
    return report;
  }
}
