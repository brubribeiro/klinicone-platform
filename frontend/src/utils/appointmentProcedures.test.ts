import { describe, expect, it } from 'vitest';

import type { Appointment, Procedure } from '../types';
import {
  appointmentProcedureIds,
  appointmentProcedureLabel,
  resolveReturnProcedures,
  returnRecurrenceDays,
} from './appointmentProcedures';

const limpeza = { id: 'p1', name: 'Limpeza' } as Procedure;
const peeling = { id: 'p2', name: 'Peeling' } as Procedure;

describe('appointmentProcedureIds', () => {
  it('uses the procedure rows in sortOrder', () => {
    expect(
      appointmentProcedureIds({
        procedureId: 'p1',
        appointmentProcedures: [
          { procedureId: 'p2', sortOrder: 1 },
          { procedureId: 'p1', sortOrder: 0 },
        ],
      }),
    ).toEqual(['p1', 'p2']);
  });

  it('falls back to the legacy procedureId when there are no rows', () => {
    expect(appointmentProcedureIds({ procedureId: 'p1', appointmentProcedures: [] })).toEqual(['p1']);
    expect(appointmentProcedureIds({ procedureId: 'p1' })).toEqual(['p1']);
  });
});

describe('appointmentProcedureLabel', () => {
  it('joins every procedure of the booking', () => {
    expect(
      appointmentProcedureLabel({
        kind: 'PROCEDURE',
        procedure: limpeza,
        appointmentProcedures: [
          { sortOrder: 1, procedure: peeling },
          { sortOrder: 0, procedure: limpeza },
        ],
      }),
    ).toBe('Limpeza + Peeling');
  });

  it('falls back to the legacy procedure when the rows are empty', () => {
    expect(
      appointmentProcedureLabel({ kind: 'PROCEDURE', procedure: limpeza, appointmentProcedures: [] }),
    ).toBe('Limpeza');
  });

  it('uses the kind when there is no procedure', () => {
    expect(appointmentProcedureLabel({ kind: 'EVALUATION', appointmentProcedures: [] })).toBe('Avaliação');
  });
});

describe('resolveReturnProcedures', () => {
  it('keeps every procedure of the completed booking, in order', () => {
    const appointment = {
      procedureId: 'p1',
      appointmentProcedures: [
        { procedureId: 'p2', sortOrder: 1, procedure: peeling },
        { procedureId: 'p1', sortOrder: 0, procedure: limpeza },
      ],
    } as Appointment;
    expect(resolveReturnProcedures(appointment, [peeling], []).map((p) => p.id)).toEqual(['p1', 'p2']);
  });

  it('falls back to the legacy procedure', () => {
    const appointment = { procedureId: 'p1', procedure: limpeza } as Appointment;
    expect(resolveReturnProcedures(appointment, [], [])).toEqual([limpeza]);
  });
});

describe('returnRecurrenceDays', () => {
  it('uses the longest interval among the procedures', () => {
    expect(
      returnRecurrenceDays([
        { ...limpeza, recurrenceDays: 30 },
        { ...peeling, recurrenceDays: 45 },
      ]),
    ).toBe(45);
  });

  it('is null when no procedure has an interval', () => {
    expect(returnRecurrenceDays([limpeza, { ...peeling, recurrenceDays: 0 }])).toBeNull();
  });
});
