import { ForbiddenException } from '@nestjs/common';
import { AppointmentKind, AppointmentStatus, Prisma } from '@prisma/client';

import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import type { ApplicationMapDto } from './dto/application-map.dto';

export type MaterialQuantity = { itemId: string; quantity: Prisma.Decimal };

export const appointmentRelationsInclude = {
  patient: true,
  procedure: true,
  professional: { select: { id: true, name: true } },
  extraMaterials: { include: { item: true } },
  patientPackage: {
    select: {
      id: true,
      sessionsTotal: true,
      sessionsUsed: true,
      package: { select: { name: true } },
    },
  },
} as const;

/** Snapshot do mapa de aplicação para gravar; sem pontos, apaga o mapa. */
export function toApplicationMapData(
  map: ApplicationMapDto | undefined,
): Prisma.InputJsonValue | typeof Prisma.DbNull | undefined {
  if (map === undefined) return undefined;
  if (map.points.length === 0) return Prisma.DbNull;
  return {
    template: map.template,
    points: map.points.map((p) => {
      const note = p.note?.trim();
      return {
        x: Math.round(p.x * 10) / 10,
        y: Math.round(p.y * 10) / 10,
        ...(note ? { note } : {}),
      };
    }),
  };
}

export function isActive(status: AppointmentStatus) {
  return (
    status === AppointmentStatus.SCHEDULED ||
    status === AppointmentStatus.CONFIRMED ||
    status === AppointmentStatus.IN_PROGRESS ||
    status === AppointmentStatus.COMPLETED
  );
}

/** Procedimento só é exigido para kind = PROCEDURE. AVAL e RETURN ficam livres. */
export function requiresProcedure(kind: AppointmentKind | null | undefined) {
  return !kind || kind === AppointmentKind.PROCEDURE;
}

export function assertOwnAppointmentAccess(professionalId: string, user?: AuthenticatedUser) {
  if (user?.restrictToOwnAppointments && professionalId !== user.id) {
    throw new ForbiddenException('Você não tem acesso a este agendamento.');
  }
}

const APPOINTMENT_KIND_LABEL: Record<AppointmentKind, string> = {
  [AppointmentKind.EVALUATION]: 'Avaliação',
  [AppointmentKind.PROCEDURE]: 'Procedimento',
  [AppointmentKind.RETURN]: 'Retorno',
};

export function appointmentServiceLabel(appt: {
  procedure?: { name: string } | null;
  kind: AppointmentKind;
}): string {
  return appt.procedure?.name ?? APPOINTMENT_KIND_LABEL[appt.kind] ?? appt.kind;
}

export function formatAppointmentDateTime(date: Date): string {
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Resolve a data (paidAt) do lançamento financeiro. Quando um mês de referência
 * ("YYYY-MM") é informado (agendamentos antigos), projeta o dia do agendamento
 * naquele mês; caso contrário usa a data atual.
 */
export function resolveRevenuePaidAt(referenceMonth: string | undefined, appointmentStart: Date): Date {
  if (!referenceMonth) return new Date();
  const match = /^(\d{4})-(\d{2})$/.exec(referenceMonth);
  if (!match) return new Date();
  const year = Number(match[1]);
  const month = Number(match[2]); // 1-12
  if (month < 1 || month > 12) return new Date();
  const lastDay = new Date(year, month, 0).getDate();
  const day = Math.min(appointmentStart.getDate(), lastDay);
  return new Date(year, month - 1, day, 12, 0, 0);
}

/**
 * Número da sessão (1-based) de cada agendamento dentro do seu pacote, a partir de
 * TODOS os agendamentos dos pacotes ordenados por startAt.
 */
export function computePackageSessionIndexes(
  packageAppointments: { id: string; patientPackageId: string | null }[],
): Map<string, number> {
  const sessionIndexById = new Map<string, number>();
  const counters = new Map<string, number>();
  for (const appt of packageAppointments) {
    if (!appt.patientPackageId) continue;
    const next = (counters.get(appt.patientPackageId) ?? 0) + 1;
    counters.set(appt.patientPackageId, next);
    sessionIndexById.set(appt.id, next);
  }
  return sessionIndexById;
}
