import { describe, expect, it } from 'vitest';

import type { PatientMeasurement } from '../../types';
import { formatMeasure, withImc } from './measurementFields';

const m = (over: Partial<PatientMeasurement>): PatientMeasurement => ({
  id: 'm',
  patientId: 'p',
  measuredAt: '2026-10-01T12:00:00.000Z',
  weightKg: null,
  heightCm: null,
  waistCm: null,
  abdomenCm: null,
  hipCm: null,
  createdAt: '2026-10-01T12:00:00.000Z',
  ...over,
});

describe('withImc', () => {
  it('usa a última altura informada quando a medição não tem altura', () => {
    const rows = withImc([m({ weightKg: 70, heightCm: 165 }), m({ weightKg: 68 }), m({ waistCm: 80 })]);
    expect(rows.map((r) => r.imc)).toEqual([25.7, 25, null]);
  });

  it('sem altura anterior não calcula IMC', () => {
    expect(withImc([m({ weightKg: 70 })])[0].imc).toBeNull();
  });
});

describe('formatMeasure', () => {
  it('formata em pt-BR com unidade', () => {
    expect(formatMeasure(72.5, 'kg')).toBe('72,5 kg');
    expect(formatMeasure(null, 'kg')).toBe('—');
  });
});
