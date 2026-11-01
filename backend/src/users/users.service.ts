import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AppointmentStatus, NotificationType } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../tenancy/tenant-context';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditLogService, AuditUser } from '../audit-log/audit-log.service';
import { R2StorageService } from '../documents/r2-storage.service';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { isClinicAdministrator, SYSTEM_ADMIN_ROLE_NAME } from '../common/permissions';
import { assertAllowedFileContent } from '../common/utils/file-magic.util';
import { PHOTO_ALLOWED_MIMES } from '../documents/upload-allowlist';
import { PlanLimitsService } from '../plan-limits/plan-limits.service';

const SAFE_SELECT = {
  id: true,
  name: true,
  email: true,
  roleId: true,
  active: true,
  providesAppointments: true,
  isPrimary: true,
  specialty: true,
  specialties: true,
  councilRegister: true,
  calendarColor: true,
  bio: true,
  photoStorageKey: true,
  photoUrl: true,
  createdAt: true,
  role: { select: { id: true, name: true, isSystem: true } },
} as const;

const PHOTO_MAX_BYTES = 5 * 1024 * 1024;
const PHOTO_URL_TTL_SECONDS = 3600;

const WEEKDAY_INDEX: Record<string, number> = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

/** Momento atual no fuso da clínica (America/Sao_Paulo). */
function clinicNowParts(): { weekday: number; minutes: number } {
  const now = new Date();
  const tz = 'America/Sao_Paulo';
  const weekdayName = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'long' }).format(now);
  const time = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(now); // "HH:MM"
  const [h, m] = time.split(':').map(Number);
  return { weekday: WEEKDAY_INDEX[weekdayName] ?? 0, minutes: h * 60 + m };
}

function hhmmToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}

export type ProfessionalAvailability = 'IN_SERVICE' | 'OFF' | 'OUTSIDE_HOURS' | 'AVAILABLE';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly auditLog: AuditLogService,
    private readonly r2: R2StorageService,
    private readonly planLimits: PlanLimitsService,
  ) {}

  /** Versão completa com password e relação para autenticação. */
  /** E-mail é único no sistema todo, então a busca ignora a clínica (login e checagem de duplicado). */
  findByEmail(email: string) {
    return TenantContext.runUnscoped(() =>
      this.prisma.user.findUnique({
        where: { email },
        include: {
          role: true,
          tenant: { include: { plan: { select: { features: true } } } },
        },
      }),
    );
  }

  /** Atualiza o nome no login Google quando o perfil do Google difere do cadastro. */
  syncNameFromGoogle(userId: string, googleName: string | undefined | null) {
    const name = googleName?.trim();
    if (!name) return Promise.resolve(null);
    return TenantContext.runUnscoped(async () => {
      const { count } = await this.prisma.user.updateMany({
        where: { id: userId, NOT: { name } },
        data: { name },
      });
      if (count === 0) return null;
      return this.prisma.user.findUnique({
        where: { id: userId },
        include: {
          role: true,
          tenant: { include: { plan: { select: { features: true } } } },
        },
      });
    });
  }

  findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: {
        role: true,
        tenant: { include: { plan: { select: { features: true } } } },
      },
    });
  }

  async list() {
    const users = await this.prisma.user.findMany({
      select: SAFE_SELECT,
      orderBy: { name: 'asc' },
    });
    const ids = users.map((u) => u.id);
    const now = new Date();
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [totalC, monthC, weekC, inProgress, unavailNow, workingHours] = await Promise.all([
      this.prisma.appointment.groupBy({
        by: ['professionalId'],
        where: { status: AppointmentStatus.COMPLETED },
        _count: { _all: true },
      }),
      this.prisma.appointment.groupBy({
        by: ['professionalId'],
        where: { status: AppointmentStatus.COMPLETED, startAt: { gte: monthAgo } },
        _count: { _all: true },
      }),
      this.prisma.appointment.groupBy({
        by: ['professionalId'],
        where: { status: AppointmentStatus.COMPLETED, startAt: { gte: weekAgo } },
        _count: { _all: true },
      }),
      this.prisma.appointment.findMany({
        where: { status: AppointmentStatus.IN_PROGRESS, professionalId: { in: ids } },
        select: { professionalId: true },
      }),
      this.prisma.unavailability.findMany({
        where: { userId: { in: ids }, startAt: { lte: now }, endAt: { gte: now } },
        select: { userId: true },
      }),
      this.prisma.workingHours.findMany({ where: { userId: { in: ids } } }),
    ]);

    const totalMap = new Map(totalC.map((c) => [c.professionalId, c._count._all]));
    const monthMap = new Map(monthC.map((c) => [c.professionalId, c._count._all]));
    const weekMap = new Map(weekC.map((c) => [c.professionalId, c._count._all]));
    const inProgressSet = new Set(inProgress.map((a) => a.professionalId));
    const unavailSet = new Set(unavailNow.map((u) => u.userId));
    const whByUser = new Map<string, { dayOfWeek: number; startTime: string; endTime: string }[]>();
    for (const w of workingHours) {
      const list = whByUser.get(w.userId) ?? [];
      list.push({ dayOfWeek: w.dayOfWeek, startTime: w.startTime, endTime: w.endTime });
      whByUser.set(w.userId, list);
    }

    const { weekday, minutes } = clinicNowParts();
    const availabilityFor = (u: { id: string; providesAppointments: boolean }): ProfessionalAvailability | null => {
      if (!u.providesAppointments) return null;
      if (inProgressSet.has(u.id)) return 'IN_SERVICE';
      if (unavailSet.has(u.id)) return 'OFF';
      const today = (whByUser.get(u.id) ?? []).filter((w) => w.dayOfWeek === weekday);
      if (today.length === 0) return 'OFF';
      const within = today.some(
        (w) => hhmmToMinutes(w.startTime) <= minutes && minutes <= hhmmToMinutes(w.endTime),
      );
      return within ? 'AVAILABLE' : 'OUTSIDE_HOURS';
    };

    const enriched = users.map((u) => ({
      ...u,
      appointmentsCount: totalMap.get(u.id) ?? 0,
      appointmentsCountMonth: monthMap.get(u.id) ?? 0,
      appointmentsCountWeek: weekMap.get(u.id) ?? 0,
      availability: availabilityFor(u),
    }));
    return this.withPhotoAccessUrls(enriched);
  }

  /** Lista resumida usada em dropdowns (qualquer autenticado) — campos mínimos */
  async listActive(forAppointments?: boolean) {
    return this.prisma.user.findMany({
      where: {
        active: true,
        ...(forAppointments ? { providesAppointments: true } : {}),
      },
      select: {
        id: true,
        name: true,
        active: true,
        providesAppointments: true,
        roleId: true,
        role: { select: { id: true, name: true, isSystem: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Impede escalação via users:create/edit (#33):
   * - ninguém altera o próprio grupo;
   * - só Administrador atribui ou remove o grupo Administrador.
   */
  private assertCanAssignRole(
    actor: AuthenticatedUser | undefined,
    targetRole: { name: string },
    opts: { targetUserId?: string; previousRoleName?: string | null },
  ) {
    if (opts.targetUserId && actor && opts.targetUserId === actor.id) {
      throw new ForbiddenException('Você não pode alterar o próprio grupo.');
    }
    const touchesAdmin =
      targetRole.name === SYSTEM_ADMIN_ROLE_NAME ||
      opts.previousRoleName === SYSTEM_ADMIN_ROLE_NAME;
    if (touchesAdmin && !isClinicAdministrator(actor?.roleName)) {
      throw new ForbiddenException(
        'Apenas administradores podem atribuir ou remover o grupo Administrador.',
      );
    }
  }

  async create(dto: CreateUserDto, actor?: AuthenticatedUser) {
    const existing = await this.findByEmail(dto.email);
    if (existing) throw new ConflictException('E-mail já cadastrado');

    const role = await this.prisma.role.findUnique({ where: { id: dto.roleId } });
    if (!role) throw new BadRequestException('Grupo (role) inválido.');
    this.assertCanAssignRole(actor, role, {});
    if (dto.active ?? true) await this.planLimits.assertCanAddUser();

    // Senha aleatória — autenticação é feita exclusivamente via Google OAuth
    const randomPassword = require('crypto').randomBytes(32).toString('hex');
    const password = await bcrypt.hash(randomPassword, 10);
    // Se marcado como principal, desmarca o anterior
    if (dto.isPrimary) {
      await this.prisma.user.updateMany({
        where: { isPrimary: true },
        data: { isPrimary: false },
      });
    }

    const created = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        password,
        roleId: dto.roleId,
        active: dto.active ?? true,
        providesAppointments: dto.providesAppointments ?? true,
        isPrimary: dto.isPrimary ?? false,
        specialty: dto.specialty ?? null,
        specialties: dto.specialties ?? [],
        councilRegister: dto.councilRegister ?? null,
        calendarColor: dto.calendarColor ?? null,
        bio: dto.bio ?? null,
      },
      select: SAFE_SELECT,
    });

    this.auditLog.logCreate('User', created.id, created as unknown as Record<string, unknown>, actor).catch(() => undefined);

    // Notifica outros administradores (exceto o próprio recém-criado)
    const admins = await this.notifications.findUsersWithPermission('users:view');
    this.notifications
      .notifyMany(
        admins.filter((a) => a.id !== created.id).map((a) => a.id),
        {
          type: NotificationType.USER_CREATED,
          title: 'Novo profissional cadastrado',
          message: `${created.name} (${created.role?.name ?? '—'})`,
          link: '/profissionais',
          metadata: { userId: created.id },
        },
      )
      .catch(() => undefined);

    return created;
  }

  async update(id: string, dto: UpdateUserDto, actor?: AuthenticatedUser) {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException('Usuário não encontrado');

    if (dto.email && dto.email !== user.email) {
      const exists = await this.findByEmail(dto.email);
      if (exists) throw new ConflictException('E-mail já cadastrado');
    }

    if (dto.roleId && dto.roleId !== user.roleId) {
      const role = await this.prisma.role.findUnique({ where: { id: dto.roleId } });
      if (!role) throw new BadRequestException('Grupo (role) inválido.');
      this.assertCanAssignRole(actor, role, {
        targetUserId: id,
        previousRoleName: user.role?.name,
      });
    }

    if (dto.active === true && !user.active) await this.planLimits.assertCanAddUser();

    // Se marcado como principal, desmarca o anterior
    if (dto.isPrimary) {
      await this.prisma.user.updateMany({
        where: { isPrimary: true, id: { not: id } },
        data: { isPrimary: false },
      });
    }

    const data: any = { ...dto };

    const updated = await this.prisma.user.update({
      where: { id },
      data,
      select: SAFE_SELECT,
    });
    this.auditLog.logUpdate('User', id, user as unknown as Record<string, unknown>, updated as unknown as Record<string, unknown>, actor).catch(() => undefined);
    return this.withPhotoAccessUrl(updated);
  }

  async remove(id: string, requesterId: string, auditUser?: AuditUser) {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException('Usuário não encontrado');
    if (id === requesterId) {
      throw new BadRequestException('Você não pode excluir o próprio usuário.');
    }
    const apptCount = await this.prisma.appointment.count({ where: { professionalId: id } });
    if (apptCount > 0) {
      const updated = await this.prisma.user.update({
        where: { id },
        data: { active: false },
        select: SAFE_SELECT,
      });
      this.auditLog.logUpdate('User', id, user as unknown as Record<string, unknown>, updated as unknown as Record<string, unknown>, auditUser).catch(() => undefined);
      return updated;
    }
    await this.prisma.user.delete({ where: { id } });
    this.auditLog.logDelete('User', id, user as unknown as Record<string, unknown>, auditUser).catch(() => undefined);
    return { ok: true };
  }

  async uploadPhoto(id: string, file: Express.Multer.File, auditUser?: AuditUser) {
    if (!this.r2.isConfigured) {
      throw new BadRequestException('Cloudflare R2 não está configurado. Não é possível enviar a foto.');
    }
    const mimeType = assertAllowedFileContent(file.buffer, file.mimetype, PHOTO_ALLOWED_MIMES);
    if (file.size > PHOTO_MAX_BYTES) {
      throw new BadRequestException('A foto deve ter no máximo 5 MB.');
    }

    const before = await this.prisma.user.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Usuário não encontrado');

    if (before.photoStorageKey) {
      await this.r2.remove(before.photoStorageKey);
    }

    const ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
    const { key } = await this.r2.upload(`foto.${ext}`, mimeType, file.buffer, `profissionais/${id}`);

    const updated = await this.prisma.user.update({
      where: { id },
      data: { photoStorageKey: key, photoUrl: null },
      select: SAFE_SELECT,
    });
    this.auditLog
      .logUpdate('User', id, before as unknown as Record<string, unknown>, updated as unknown as Record<string, unknown>, auditUser)
      .catch(() => undefined);
    return this.withPhotoAccessUrl(updated);
  }

  async removePhoto(id: string, auditUser?: AuditUser) {
    const before = await this.prisma.user.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Usuário não encontrado');
    if (before.photoStorageKey) {
      await this.r2.remove(before.photoStorageKey);
    }
    const updated = await this.prisma.user.update({
      where: { id },
      data: { photoStorageKey: null, photoUrl: null },
      select: SAFE_SELECT,
    });
    this.auditLog
      .logUpdate('User', id, before as unknown as Record<string, unknown>, updated as unknown as Record<string, unknown>, auditUser)
      .catch(() => undefined);
    return updated;
  }

  async getPhotoAccessUrl(id: string): Promise<{ url: string | null }> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { photoStorageKey: true },
    });
    if (!user?.photoStorageKey) return { url: null };
    const url = await this.r2.getPresignedUrl(user.photoStorageKey, PHOTO_URL_TTL_SECONDS);
    return { url };
  }

  private async withPhotoAccessUrl<T extends { photoStorageKey?: string | null; photoUrl?: string | null }>(
    user: T,
  ): Promise<T> {
    if (user.photoStorageKey && this.r2.isConfigured) {
      try {
        const url = await this.r2.getPresignedUrl(user.photoStorageKey, PHOTO_URL_TTL_SECONDS);
        return { ...user, photoUrl: url };
      } catch {
        return { ...user, photoUrl: null };
      }
    }
    return { ...user, photoUrl: null };
  }

  private async withPhotoAccessUrls<T extends { photoStorageKey?: string | null; photoUrl?: string | null }>(
    users: T[],
  ): Promise<T[]> {
    return Promise.all(users.map((u) => this.withPhotoAccessUrl(u)));
  }
}
