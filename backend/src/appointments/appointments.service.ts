import { ForbiddenException, BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AppointmentStatus, AppointmentKind } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { AuditUser } from '../audit-log/audit-log.service';
import { AvailabilityService } from '../availability/availability.service';
import { PackagesService } from '../packages/packages.service';
import { AppointmentRulesService } from './appointment-rules.service';
import { AppointmentMaterialsService } from './appointment-materials.service';
import { AppointmentFinanceService } from './appointment-finance.service';
import { parseDateOnlyToUtcNoon } from '../common/utils/date-only.util';
import { AppointmentEventsService } from './appointment-events.service';
import {
  appointmentRelationsInclude,
  assertOwnAppointmentAccess,
  computePackageSessionIndexes,
  isActive,
  toApplicationMapData,
} from './appointment.helpers';

/** Campos que usuários restritos aos próprios agendamentos não podem alterar. */
const RESTRICTED_UPDATE_FIELDS = ['patientId', 'procedureId', 'professionalId', 'startAt', 'endAt'] as const;

@Injectable()
export class AppointmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly availability: AvailabilityService,
    private readonly packagesService: PackagesService,
    private readonly rules: AppointmentRulesService,
    private readonly materials: AppointmentMaterialsService,
    private readonly finance: AppointmentFinanceService,
    private readonly events: AppointmentEventsService,
  ) {}

  async list(from?: string, to?: string, professionalId?: string) {
    const appointments = await this.prisma.appointment.findMany({
      where: {
        ...(professionalId ? { professionalId } : {}),
        startAt: {
          gte: from ? new Date(from) : undefined,
          lte: to ? new Date(to) : undefined,
        },
      },
      include: appointmentRelationsInclude,
      orderBy: { startAt: 'asc' },
    });

    // Número da sessão considera TODOS os agendamentos do pacote (não só os do intervalo visível).
    const packageIds = Array.from(
      new Set(appointments.map((a) => a.patientPackageId).filter((id): id is string => !!id)),
    );
    const sessionIndexById =
      packageIds.length > 0
        ? computePackageSessionIndexes(
            await this.prisma.appointment.findMany({
              where: { patientPackageId: { in: packageIds } },
              select: { id: true, patientPackageId: true, startAt: true },
              orderBy: { startAt: 'asc' },
            }),
          )
        : new Map<string, number>();

    return appointments.map((a) => ({
      ...a,
      sessionIndex: a.patientPackageId ? sessionIndexById.get(a.id) ?? null : null,
    }));
  }

  /**
   * Retorna agendamentos "pendentes": já passaram (endAt < agora) mas
   * não estão com status COMPLETED, CANCELLED ou NO_SHOW.
   */
  pending(professionalId?: string) {
    return this.prisma.appointment.findMany({
      where: {
        ...(professionalId ? { professionalId } : {}),
        endAt: { lt: new Date() },
        status: {
          in: [
            AppointmentStatus.SCHEDULED,
            AppointmentStatus.CONFIRMED,
            AppointmentStatus.IN_PROGRESS,
          ],
        },
      },
      include: appointmentRelationsInclude,
      orderBy: { startAt: 'desc' },
    });
  }

  async findOne(id: string, user?: AuthenticatedUser) {
    const appt = await this.prisma.appointment.findUnique({
      where: { id },
      include: {
        patient: true,
        procedure: true,
        professional: true,
        extraMaterials: { include: { item: true } },
      },
    });
    if (!appt) throw new NotFoundException('Agendamento não encontrado');
    assertOwnAppointmentAccess(appt.professionalId, user);
    return appt;
  }

  getRecurrenceLimit(patientId: string, procedureId: string, excludeAppointmentId?: string) {
    return this.rules.getRecurrenceLimit(patientId, procedureId, excludeAppointmentId);
  }

  /** Valor cheio, desconto e valor final do procedimento no dia (YYYY-MM-DD), antes de concluir. */
  promotionPreview(procedureId: string, date: string) {
    const day = /^\d{4}-\d{2}-\d{2}$/.test(date ?? '') ? parseDateOnlyToUtcNoon(date) : undefined;
    if (!day) throw new BadRequestException('Data inválida (use AAAA-MM-DD).');
    return this.finance.previewPromotion(procedureId, day);
  }

  async create(dto: CreateAppointmentDto, user?: AuditUser) {
    const kind = dto.kind ?? AppointmentKind.PROCEDURE;
    const startAt = new Date(dto.startAt);
    const endAt = new Date(dto.endAt);

    this.rules.assertProcedureProvided(kind, dto.procedureId);
    await this.rules.assertCreateReferences(dto, kind);
    // Validação de disponibilidade (working hours + indisponibilidade + conflitos)
    await this.rules.assertProfessionalAvailable(dto.professionalId, startAt, endAt);
    if (dto.procedureId) {
      await this.rules.assertRecurrenceInterval(dto.patientId, dto.procedureId, startAt);
    }
    if (dto.patientPackageId) {
      await this.rules.assertPackageBelongsToPatient(dto.patientPackageId, dto.patientId);
    }

    const appt = await this.prisma.$transactionWithRetry(async (tx) => {
      await this.availability.assertNoAppointmentConflict(
        dto.professionalId,
        startAt,
        endAt,
        undefined,
        tx,
      );

      const status = dto.status ?? AppointmentStatus.SCHEDULED;
      const extraItems = this.materials.normalizeExtraMaterials(dto.extraMaterials);
      const willDeduct = isActive(status) && (!!dto.procedureId || extraItems.length > 0);

      if (willDeduct && dto.procedureId) {
        await this.materials.deductProcedureMaterials(tx, dto.procedureId, 'Materiais do agendamento');
      }
      if (willDeduct && extraItems.length > 0) {
        await this.materials.deductItems(tx, extraItems, 'Materiais extras do agendamento');
      }

      const created = await tx.appointment.create({
        data: {
          patientId: dto.patientId,
          procedureId: dto.procedureId ?? null,
          professionalId: dto.professionalId,
          startAt,
          endAt,
          status,
          kind,
          notes: dto.notes,
          clinicalNotes: dto.clinicalNotes,
          materialsDeducted: willDeduct,
          patientPackageId: dto.patientPackageId ?? null,
        },
        include: appointmentRelationsInclude,
      });

      if (extraItems.length > 0) {
        await this.materials.replaceExtraMaterialRecords(tx, created.id, extraItems);
      }

      return created;
    });

    this.events.created(appt, user);
    return appt;
  }

  async update(id: string, dto: UpdateAppointmentDto, user?: AuthenticatedUser) {
    const current = await this.prisma.appointment.findUnique({
      where: { id },
      include: appointmentRelationsInclude,
    });
    if (!current) throw new NotFoundException('Agendamento não encontrado');

    const scheduleChanged = !!(dto.startAt || dto.endAt || dto.professionalId);
    const requestedSlot = (base: { startAt: Date; endAt: Date; professionalId: string }) => ({
      startAt: dto.startAt ? new Date(dto.startAt) : base.startAt,
      endAt: dto.endAt ? new Date(dto.endAt) : base.endAt,
      professionalId: dto.professionalId ?? base.professionalId,
    });

    // Quando há mudança de horário/profissional, valida disponibilidade
    if (scheduleChanged) {
      const slot = requestedSlot(current);
      await this.rules.assertProfessionalAvailable(slot.professionalId, slot.startAt, slot.endAt, id);
    }

    const recurrenceProcedureId =
      dto.procedureId === undefined ? current.procedureId : dto.procedureId;
    if (recurrenceProcedureId) {
      await this.rules.assertRecurrenceInterval(
        dto.patientId ?? current.patientId,
        recurrenceProcedureId,
        dto.startAt ? new Date(dto.startAt) : current.startAt,
        id,
      );
    }

    const result = await this.prisma.$transactionWithRetry(async (tx) => {
      const before = await tx.appointment.findUnique({
        where: { id },
        include: { extraMaterials: true },
      });
      if (!before) throw new NotFoundException('Agendamento não encontrado');

      if (user?.restrictToOwnAppointments) {
        assertOwnAppointmentAccess(before.professionalId, user);
        if (RESTRICTED_UPDATE_FIELDS.some((f) => dto[f] !== undefined)) {
          throw new ForbiddenException(
            'Seu grupo só permite atualizar o status e as observações do agendamento.',
          );
        }
      }

      if (scheduleChanged) {
        const slot = requestedSlot(before);
        await this.availability.assertNoAppointmentConflict(
          slot.professionalId,
          slot.startAt,
          slot.endAt,
          id,
          tx,
        );
      }

      const newStatus = dto.status ?? before.status;
      const newProcedureId = dto.procedureId ?? before.procedureId;
      const willBeActive = isActive(newStatus);
      const extraItems =
        dto.extraMaterials !== undefined
          ? this.materials.normalizeExtraMaterials(dto.extraMaterials)
          : undefined;
      const willHaveExtras =
        extraItems !== undefined ? extraItems.length > 0 : before.extraMaterials.length > 0;
      const willDeduct = willBeActive && (!!newProcedureId || willHaveExtras);

      this.rules.assertProcedureProvided(dto.kind ?? before.kind, newProcedureId);

      await this.materials.syncOnUpdate(tx, before, {
        procedureId: newProcedureId,
        willBeActive,
        willDeduct,
        extraItems,
      });

      // Geração automática de lançamento financeiro quando completa
      const packageId = dto.patientPackageId ?? before.patientPackageId;
      const wasCompleted = before.status === AppointmentStatus.COMPLETED;
      const nowCompleted = newStatus === AppointmentStatus.COMPLETED;
      let financeGenerated = before.financeGenerated;

      if (nowCompleted && !before.financeGenerated && newProcedureId) {
        financeGenerated = await this.finance.generateForCompletion(tx, {
          appointmentId: id,
          patientId: before.patientId,
          startAt: before.startAt,
          procedureId: newProcedureId,
          packageId,
          extraMaterials: extraItems ?? before.extraMaterials,
          referenceMonth: dto.referenceMonth,
          paymentMethodId: dto.paymentMethodId,
          installments: dto.installments,
          cardBrand: dto.cardBrand,
          authorizationCode: dto.authorizationCode,
        });
      }

      // Controle de sessões de pacote
      if (packageId && !wasCompleted && nowCompleted) {
        await this.packagesService.incrementSession(packageId);
      } else if (packageId && wasCompleted && !nowCompleted) {
        await this.packagesService.decrementSession(packageId);
      }

      return tx.appointment.update({
        where: { id },
        data: {
          patientId: dto.patientId,
          procedureId: dto.procedureId === undefined ? undefined : dto.procedureId ?? null,
          professionalId: dto.professionalId,
          startAt: dto.startAt ? new Date(dto.startAt) : undefined,
          endAt: dto.endAt ? new Date(dto.endAt) : undefined,
          status: dto.status,
          kind: dto.kind,
          notes: dto.notes,
          clinicalNotes: dto.clinicalNotes,
          materialsDeducted: willDeduct,
          financeGenerated,
          patientPackageId: dto.patientPackageId === undefined ? undefined : dto.patientPackageId ?? null,
          applicationMap: toApplicationMapData(dto.applicationMap),
        },
        include: appointmentRelationsInclude,
      });
    });

    this.events.updated(current, result, dto.status === AppointmentStatus.CANCELLED, user);
    return result;
  }

  backfillFinance() {
    return this.finance.backfill();
  }

  /** Inicia o atendimento: marca startedAt e muda status para IN_PROGRESS */
  async start(id: string, user?: AuthenticatedUser) {
    const appt = await this.findByIdOrThrow(id);
    assertOwnAppointmentAccess(appt.professionalId, user);
    if (
      appt.status !== AppointmentStatus.SCHEDULED &&
      appt.status !== AppointmentStatus.CONFIRMED
    ) {
      throw new BadRequestException(
        'Só é possível iniciar atendimentos com status Agendado ou Confirmado.',
      );
    }
    return this.updateWithRelations(id, {
      status: AppointmentStatus.IN_PROGRESS,
      startedAt: new Date(),
    });
  }

  /** Finaliza o atendimento: marca finishedAt. A conclusão completa (COMPLETED) continua pelo update normal. */
  async finish(id: string, user?: AuthenticatedUser) {
    const appt = await this.findByIdOrThrow(id);
    assertOwnAppointmentAccess(appt.professionalId, user);
    if (appt.status !== AppointmentStatus.IN_PROGRESS) {
      throw new BadRequestException(
        'Só é possível finalizar atendimentos com status Em Atendimento.',
      );
    }
    return this.updateWithRelations(id, { finishedAt: new Date() });
  }

  /** Retoma o atendimento: limpa finishedAt para continuar o cronômetro */
  async resume(id: string, user?: AuthenticatedUser) {
    const appt = await this.findByIdOrThrow(id);
    assertOwnAppointmentAccess(appt.professionalId, user);
    if (appt.status !== AppointmentStatus.IN_PROGRESS) {
      throw new BadRequestException(
        'Só é possível retomar atendimentos com status Em Atendimento.',
      );
    }
    return this.updateWithRelations(id, { finishedAt: null });
  }

  async remove(id: string, user?: AuditUser) {
    const oldData = await this.prisma.appointment.findUnique({
      where: { id },
      include: appointmentRelationsInclude,
    });

    const result = await this.prisma.$transactionWithRetry(async (tx) => {
      const appt = await tx.appointment.findUnique({ where: { id } });
      if (!appt) throw new NotFoundException('Agendamento não encontrado');

      if (appt.materialsDeducted) {
        await this.materials.returnAllForAppointment(
          tx,
          appt,
          'Devolução por exclusão do agendamento',
          'Devolução de materiais extras por exclusão do agendamento',
        );
      }

      // Devolver sessão do pacote se o agendamento já tinha sido concluído
      if (appt.patientPackageId && appt.status === AppointmentStatus.COMPLETED) {
        await this.packagesService.decrementSession(appt.patientPackageId);
      }

      await tx.appointment.delete({ where: { id } });
      return { ok: true };
    });

    if (oldData) this.events.deleted(id, oldData, user);
    return result;
  }

  private async findByIdOrThrow(id: string) {
    const appt = await this.prisma.appointment.findUnique({ where: { id } });
    if (!appt) throw new NotFoundException('Agendamento não encontrado');
    return appt;
  }

  private updateWithRelations(
    id: string,
    data: { status?: AppointmentStatus; startedAt?: Date; finishedAt?: Date | null },
  ) {
    return this.prisma.appointment.update({
      where: { id },
      data,
      include: appointmentRelationsInclude,
    });
  }
}
