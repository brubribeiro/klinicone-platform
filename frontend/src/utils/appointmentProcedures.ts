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
  procedure?: Procedure | null;
  appointmentProcedures?: AppointmentProcedureRow[];
}): string {
  const joinNames = appointment.appointmentProcedures?.map((row) => row.procedure?.name).filter(Boolean) ?? [];
  // Sem itens na tabela de junção (agendamento legado/seed), vale o procedimento principal.
  const names = joinNames.length > 0 ? joinNames : appointment.procedure?.name ? [appointment.procedure.name] : [];
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
