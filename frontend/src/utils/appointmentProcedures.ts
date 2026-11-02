import type { Appointment, Procedure } from '../types';

export interface AppointmentProcedureRow {
  procedureId: string;
  sortOrder?: number;
  procedure?: Procedure;
}

export function appointmentProcedureIds(appointment: {
  procedureId?: string | null;
  appointmentProcedures?: AppointmentProcedureRow[];
}): string[] {
  const fromJoin = appointment.appointmentProcedures
    ?.slice()
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .map((row) => row.procedureId)
    .filter(Boolean);
  if (fromJoin?.length) return fromJoin;
  return appointment.procedureId ? [appointment.procedureId] : [];
}

export function appointmentProcedureLabel(appointment: {
  kind: Appointment['kind'];
  procedure?: Pick<Procedure, 'name'> | null;
  appointmentProcedures?: { sortOrder?: number; procedure?: Pick<Procedure, 'name'> }[];
}): string {
  const fromJoin = (appointment.appointmentProcedures ?? [])
    .slice()
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .map((row) => row.procedure?.name)
    .filter(Boolean);
  const names =
    fromJoin.length > 0 ? fromJoin : appointment.procedure?.name ? [appointment.procedure.name] : [];
  if (names.length > 0) return names.join(' + ');
  if (appointment.kind === 'EVALUATION') return 'Avaliação';
  if (appointment.kind === 'RETURN') return 'Retorno';
  return '';
}

export function totalDurationMinutes(procedures: Procedure[], procedureIds: string[]): number {
  if (procedureIds.length === 0) return 60;
  return procedureIds.reduce(
    (sum, id) => sum + (procedures.find((p) => p.id === id)?.durationMinutes ?? 60),
    0,
  );
}

export function selectedProcedures(procedures: Procedure[], procedureIds: string[]): Procedure[] {
  return procedureIds
    .map((id) => procedures.find((p) => p.id === id))
    .filter((p): p is Procedure => !!p);
}

/** Procedimentos do atendimento concluído, na ordem dele (catálogo, depois os embutidos no agendamento). */
export function resolveReturnProcedures(
  appointment: Appointment,
  catalog: Procedure[],
  fallback: Procedure[],
): Procedure[] {
  const embedded = [
    ...(appointment.appointmentProcedures ?? []).map((row) => row.procedure),
    appointment.procedure,
    ...fallback,
  ].filter((p): p is Procedure => !!p);
  return appointmentProcedureIds(appointment)
    .map((id) => catalog.find((p) => p.id === id) ?? embedded.find((p) => p.id === id))
    .filter((p): p is Procedure => !!p);
}

/** O backend valida o intervalo de cada procedimento: vale o maior deles. */
export function returnRecurrenceDays(procedures: Procedure[]): number | null {
  const days = procedures.map((p) => p.recurrenceDays ?? 0).filter((d) => d > 0);
  return days.length ? Math.max(...days) : null;
}
