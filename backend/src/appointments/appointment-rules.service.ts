import { BadRequestException, Injectable } from '@nestjs/common';
import { AppointmentKind, AppointmentStatus } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { AvailabilityService } from '../availability/availability.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { requiresProcedure } from './appointment.helpers';
import {
  computeEarliestRecurrenceDate,
  isBeforeRecurrenceEarliest,
  toDateInputValue,
} from './recurrence.util';

/** Validações de agendamento: referências, disponibilidade e intervalo de retorno. */
@Injectable()
export class AppointmentRulesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly availability: AvailabilityService,
  ) {}

  /**
   * Valida se o profissional está disponível no intervalo:
   * - Não pode cair dentro de uma indisponibilidade
   * - Deve cair dentro do horário semanal (se houver algum configurado)
   * - excludeId: agendamento sendo editado (não considera ele próprio como conflito)
   */
  async assertProfessionalAvailable(
    professionalId: string,
    startAt: Date,
    endAt: Date,
    excludeId?: string,
  ) {
    const professional = await this.prisma.user.findUnique({
      where: { id: professionalId },
      select: { active: true, providesAppointments: true },
    });
    if (!professional?.active || !professional.providesAppointments) {
      throw new BadRequestException('Este usuário não realiza atendimentos.');
    }

    await this.availability.checkProfessionalSlot(professionalId, startAt, endAt, excludeId);
  }

  async getRecurrenceLimit(patientId: string, procedureId: string, excludeAppointmentId?: string) {
    const empty = {
      earliestDate: null as string | null,
      recurrenceDays: null as number | null,
      lastCompletedAt: null as string | null,
    };

    if (!patientId || !procedureId) return empty;

    const procedure = await this.prisma.procedure.findUnique({
      where: { id: procedureId },
      select: { recurrenceDays: true },
    });
    if (!procedure?.recurrenceDays || procedure.recurrenceDays <= 0) return empty;

    const lastCompleted = await this.prisma.appointment.findFirst({
      where: {
        patientId,
        status: AppointmentStatus.COMPLETED,
        ...(excludeAppointmentId ? { id: { not: excludeAppointmentId } } : {}),
        OR: [
          { procedureId },
          { appointmentProcedures: { some: { procedureId } } },
        ],
      },
      orderBy: { startAt: 'desc' },
    });

    if (!lastCompleted) {
      return { ...empty, recurrenceDays: procedure.recurrenceDays };
    }

    const earliest = computeEarliestRecurrenceDate(lastCompleted.startAt, procedure.recurrenceDays);
    return {
      earliestDate: toDateInputValue(earliest),
      recurrenceDays: procedure.recurrenceDays,
      lastCompletedAt: lastCompleted.startAt.toISOString(),
    };
  }

  async assertRecurrenceInterval(
    patientId: string,
    procedureId: string,
    startAt: Date,
    excludeAppointmentId?: string,
  ) {
    const limit = await this.getRecurrenceLimit(patientId, procedureId, excludeAppointmentId);
    if (!limit.lastCompletedAt || !limit.recurrenceDays) return;

    const earliest = computeEarliestRecurrenceDate(
      new Date(limit.lastCompletedAt),
      limit.recurrenceDays,
    );

    if (isBeforeRecurrenceEarliest(startAt, earliest)) {
      throw new BadRequestException(
        `Intervalo de retorno: agende a partir de ${earliest.toLocaleDateString('pt-BR')} (${limit.recurrenceDays} dias após o último atendimento concluído).`,
      );
    }
  }

  async assertCreateReferences(dto: CreateAppointmentDto, kind: AppointmentKind) {
    const patient = await this.prisma.patient.findUnique({
      where: { id: dto.patientId },
      select: { id: true },
    });
    if (!patient) {
      throw new BadRequestException('Paciente não encontrado.');
    }

    const professional = await this.prisma.user.findUnique({
      where: { id: dto.professionalId },
      select: { id: true },
    });
    if (!professional) {
      throw new BadRequestException('Profissional não encontrado.');
    }

    const ids = dto.procedureIds?.length
      ? dto.procedureIds
      : dto.procedureId
        ? [dto.procedureId]
        : [];
    if (ids.length === 0) return;

    const procedures = await this.prisma.procedure.findMany({
      where: { id: { in: ids } },
      select: { id: true, active: true },
    });
    if (procedures.length !== ids.length) {
      throw new BadRequestException('Um ou mais procedimentos não foram encontrados.');
    }
    if (requiresProcedure(kind) && procedures.some((p) => !p.active)) {
      throw new BadRequestException('Procedimento inativo.');
    }
  }

  async assertPackageBelongsToPatient(patientPackageId: string, patientId: string) {
    const patientPkg = await this.prisma.patientPackage.findFirst({
      where: { id: patientPackageId, patientId },
    });
    if (!patientPkg) {
      throw new BadRequestException('Pacote selecionado não pertence a este paciente ou não existe.');
    }
  }

  assertProcedureProvided(
    kind: AppointmentKind | null | undefined,
    procedureId?: string | null,
    procedureIds?: string[],
  ) {
    const count = procedureIds?.length ?? (procedureId ? 1 : 0);
    if (requiresProcedure(kind) && count === 0) {
      throw new BadRequestException('Procedimento é obrigatório para agendamentos do tipo PROCEDURE.');
    }
  }
}
