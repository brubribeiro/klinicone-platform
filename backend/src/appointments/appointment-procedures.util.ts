import { BadRequestException } from '@nestjs/common';
import { AppointmentKind, Prisma } from '@prisma/client';

import { requiresProcedure } from './appointment.helpers';

type ProcedureIdsSource = {
  procedureIds?: string[];
  procedureId?: string | null;
};

/** IDs únicos na ordem enviada (procedureIds tem prioridade sobre procedureId legado). */
export function resolveProcedureIds(source: ProcedureIdsSource): string[] {
  if (source.procedureIds?.length) {
    const seen = new Set<string>();
    const ids: string[] = [];
    for (const raw of source.procedureIds) {
      const id = raw?.trim();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      ids.push(id);
    }
    return ids;
  }
  if (source.procedureId) return [source.procedureId];
  return [];
}

export function assertProceduresProvided(kind: AppointmentKind | null | undefined, procedureIds: string[]) {
  if (requiresProcedure(kind) && procedureIds.length === 0) {
    throw new BadRequestException('Informe ao menos um procedimento para agendamentos do tipo PROCEDURE.');
  }
}

export async function syncAppointmentProcedureRows(
  tx: Prisma.TransactionClient,
  appointmentId: string,
  procedureIds: string[],
) {
  await tx.appointmentProcedure.deleteMany({ where: { appointmentId } });
  if (procedureIds.length === 0) return;
  await tx.appointmentProcedure.createMany({
    data: procedureIds.map((procedureId, sortOrder) => ({
      appointmentId,
      procedureId,
      sortOrder,
    })),
  });
}

export async function loadAppointmentProcedureIds(
  tx: Prisma.TransactionClient,
  appointmentId: string,
  fallbackProcedureId: string | null,
): Promise<string[]> {
  const rows = await tx.appointmentProcedure.findMany({
    where: { appointmentId },
    orderBy: { sortOrder: 'asc' },
    select: { procedureId: true },
  });
  if (rows.length > 0) return rows.map((r) => r.procedureId);
  return fallbackProcedureId ? [fallbackProcedureId] : [];
}
