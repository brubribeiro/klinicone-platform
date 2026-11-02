import type { Prisma } from '@prisma/client';

import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import type { PrismaService } from '../prisma/prisma.service';

export type PlatformAuditAction =
  | 'TENANT_CREATE'
  | 'TENANT_UPDATE'
  | 'TENANT_SUSPEND'
  | 'TENANT_REACTIVATE'
  | 'TENANT_ENTER'
  | 'TENANT_PLAN_CHANGE'
  | 'TENANT_FEATURES_CHANGE'
  | 'PLAN_CREATE'
  | 'PLAN_UPDATE'
  | 'PLAN_ACTIVATE'
  | 'PLAN_DEACTIVATE'
  | 'CATALOG_CREATE'
  | 'CATALOG_UPDATE'
  | 'CATALOG_ACTIVATE'
  | 'CATALOG_DEACTIVATE'
  | 'FEEDBACK_STATUS_CHANGE'
  | 'ANNOUNCEMENT_GENERATE'
  | 'ANNOUNCEMENT_CREATE'
  | 'ANNOUNCEMENT_UPDATE'
  | 'ANNOUNCEMENT_DELETE'
  | 'ANNOUNCEMENT_SCHEDULE'
  | 'ANNOUNCEMENT_UNSCHEDULE'
  | 'ANNOUNCEMENT_SEND';

/** Grava uma ação do super-admin em platform_audit_logs. Em ações de plano/catálogo, `tenantId` é nulo. */
export async function recordPlatformAudit(
  prisma: PrismaService,
  actor: AuthenticatedUser,
  action: PlatformAuditAction,
  target: { tenantId: string | null; name: string },
  details?: Record<string, unknown>,
) {
  await prisma.platformAuditLog.create({
    data: {
      action,
      actorId: actor.id,
      actorName: actor.name,
      actorEmail: actor.email,
      targetTenantId: target.tenantId,
      targetName: target.name,
      ...(details ? { details: details as Prisma.InputJsonValue } : {}),
    },
  });
}
