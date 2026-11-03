import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../tenancy/tenant-context';
import { recordPlatformAudit } from './platform-audit';
import {
  ensureSuperAdmin,
  listSuperAdmins,
  revokeSuperAdmin,
  SuperAdminRuleError,
  type SuperAdminListItem,
} from './super-admins.core';
import type { CreateSuperAdminDto } from './dto/super-admin.dto';

export type SuperAdminDto = {
  id: string;
  name: string;
  email: string;
  hasClinic: boolean;
  tenantId: string | null;
  tenantName: string | null;
  tenantSlug: string | null;
  active: boolean;
  createdAt: Date;
  lastAccessAt: Date | null;
};

/** CRUD de super-admins da plataforma (listar, adicionar/promover, remover permissão). */
@Injectable()
export class SuperAdminsService {
  constructor(private readonly prisma: PrismaService) {}

  list(): Promise<SuperAdminDto[]> {
    return TenantContext.runUnscoped(async () => {
      const rows = await listSuperAdmins(this.prisma);
      return rows.map(toDto);
    });
  }

  create(dto: CreateSuperAdminDto, actor: AuthenticatedUser): Promise<SuperAdminDto> {
    return TenantContext.runUnscoped(async () => {
      const result = await ensureSuperAdmin(this.prisma, {
        email: dto.email,
        name: dto.name,
        nameProvided: true,
      });

      if (result.status === 'already') {
        throw new ConflictException(`“${result.user.email}” já é super-admin.`);
      }

      const action = result.status === 'promoted' ? 'SUPER_ADMIN_PROMOTE' : 'SUPER_ADMIN_CREATE';
      await recordPlatformAudit(
        this.prisma,
        actor,
        action,
        { tenantId: result.user.tenantId, name: result.user.name },
        {
          userId: result.user.id,
          email: result.user.email,
          dual: !!result.user.tenantId,
        },
      );

      return this.toDtoById(result.user.id);
    });
  }

  remove(id: string, actor: AuthenticatedUser) {
    return TenantContext.runUnscoped(async () => {
      try {
        const result = await revokeSuperAdmin(this.prisma, { targetId: id, actorId: actor.id });
        const action =
          result.outcome === 'demoted'
            ? 'SUPER_ADMIN_DEMOTE'
            : result.outcome === 'deactivated'
              ? 'SUPER_ADMIN_DEACTIVATE'
              : 'SUPER_ADMIN_DELETE';

        await recordPlatformAudit(
          this.prisma,
          actor,
          action,
          { tenantId: result.user.tenantId, name: result.user.name },
          {
            userId: result.user.id,
            email: result.user.email,
            dual: !!result.user.tenantId,
            outcome: result.outcome,
          },
        );

        return { ok: true as const, outcome: result.outcome };
      } catch (err) {
        throw mapRuleError(err);
      }
    });
  }

  private async toDtoById(id: string): Promise<SuperAdminDto> {
    const rows = await listSuperAdmins(this.prisma);
    const found = rows.find((r) => r.id === id);
    if (!found) throw new NotFoundException('Super-admin não encontrado.');
    return toDto(found);
  }
}

function toDto(row: SuperAdminListItem): SuperAdminDto {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    hasClinic: row.hasClinic,
    tenantId: row.tenantId,
    tenantName: row.tenant?.name ?? null,
    tenantSlug: row.tenant?.slug ?? null,
    active: row.active,
    createdAt: row.createdAt,
    lastAccessAt: row.lastAccessAt,
  };
}

function mapRuleError(err: unknown): never {
  if (err instanceof SuperAdminRuleError) {
    if (err.code === 'not_found') throw new NotFoundException(err.message);
    throw new BadRequestException(err.message);
  }
  throw err;
}
