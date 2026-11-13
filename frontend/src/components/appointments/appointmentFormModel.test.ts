import { describe, expect, it } from 'vitest';

import type { Appointment, Procedure } from '../../types';
import dayjs from 'dayjs';

import {
  appointmentToFormValues,
  reconcileProcedureIds,
  resolveAppointmentEnd,
} from './appointmentFormModel';

const limpeza = { id: 'p1', name: 'Limpeza', durationMinutes: 45 } as Procedure;
const peeling = { id: 'p2', name: 'Peeling', durationMinutes: 30 } as Procedure;

const baseAppointment = {
  id: 'a1',
  patientId: 'pat-1',
  professionalId: 'pro-1',
  startAt: '2026-10-26T11:40:00.000Z',
  endAt: '2026-10-26T12:25:00.000Z',
  status: 'COMPLETED',
  kind: 'PROCEDURE',
} as Appointment;

describe('appointmentToFormValues', () => {
  it('fills the procedures of a legacy appointment from procedureId', () => {
    const values = appointmentToFormValues({
      ...baseAppointment,
      procedureId: 'p1',
      procedure: limpeza,
      appointmentProcedures: [],
    });

    expect(values.procedureIds).toEqual(['p1']);
    expect(values.kind).toBe('PROCEDURE');
    expect(values.status).toBe('COMPLETED');
  });

  it('keeps every procedure of a multi-procedure appointment in order', () => {
    const values = appointmentToFormValues({
      ...baseAppointment,
      procedureId: 'p1',
      appointmentProcedures: [
        { procedureId: 'p1', sortOrder: 0, procedure: limpeza },
        { procedureId: 'p2', sortOrder: 1, procedure: peeling },
      ],
    });

    expect(values.procedureIds).toEqual(['p1', 'p2']);
  });
});

describe('reconcileProcedureIds', () => {
  it('clears the selection when the kind is not a procedure', () => {
    expect(reconcileProcedureIds('EVALUATION', ['p1'], [limpeza], true)).toEqual([]);
  });

  it('keeps the selection while the procedure catalog is loading', () => {
    expect(reconcileProcedureIds('PROCEDURE', ['p1', 'p2'], [], false)).toEqual(['p1', 'p2']);
  });

  it('drops procedures that are not among the loaded options', () => {
    expect(reconcileProcedureIds('PROCEDURE', ['p1', 'p2'], [peeling], true)).toEqual(['p2']);
  });
});

describe('resolveAppointmentEnd', () => {
  const saved = {
    ...baseAppointment,
    procedureId: 'p1',
    appointmentProcedures: [{ procedureId: 'p1', sortOrder: 0 }],
    // salvo com 60 min, diferente da duração atual do procedimento (45)
    endAt: '2026-10-26T12:40:00.000Z',
  } as Appointment;

  it('keeps the saved end when start and procedures did not change', () => {
    const end = resolveAppointmentEnd(dayjs(saved.startAt), ['p1'], [limpeza, peeling], saved);
    expect(end.toISOString()).toBe('2026-10-26T12:40:00.000Z');
  });

  it('recomputes from durations when the start changes', () => {
    const end = resolveAppointmentEnd(
      dayjs('2026-10-26T13:00:00.000Z'),
      ['p1'],
      [limpeza, peeling],
      saved,
    );
    expect(end.toISOString()).toBe('2026-10-26T13:45:00.000Z');
  });

  it('recomputes from durations when procedures change', () => {
    const end = resolveAppointmentEnd(dayjs(saved.startAt), ['p1', 'p2'], [limpeza, peeling], saved);
    expect(end.toISOString()).toBe('2026-10-26T12:55:00.000Z');
  });

  it('uses the summed duration for a new appointment', () => {
    const end = resolveAppointmentEnd(dayjs(saved.startAt), ['p2'], [limpeza, peeling]);
    expect(end.toISOString()).toBe('2026-10-26T12:10:00.000Z');
  });
});
