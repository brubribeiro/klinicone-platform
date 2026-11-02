import { describe, expect, it } from 'vitest';

import type { MeasurementType, PatientMeasurement } from '../../types';
import { formatMeasure, measureColumns, measureValue, withImc } from './measurementFields';

const m = (over: Partial<PatientMeasurement>): PatientMeasurement => ({
  id: 'm',
  patientId: 'p',
  measuredAt: '2026-10-01T12:00:00.000Z',
  weightKg: null,
  heightCm: null,
  values: [],
  createdAt: '2026-10-01T12:00:00.000Z',
  ...over,
});

describe('withImc', () => {
  it('usa a última altura informada quando a medição não tem altura', () => {
    const rows = withImc([m({ weightKg: 70, heightCm: 165 }), m({ weightKg: 68 }), m({ notes: 'só cintura' })]);
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

describe('measureColumns', () => {
  const types: MeasurementType[] = [
    { id: 't-w', key: 'weightKg', name: 'Peso', unit: 'kg', sortOrder: 0 },
    { id: 't-h', key: 'heightCm', name: 'Altura', unit: 'cm', sortOrder: 1 },
    { id: 't-coxa', key: null, name: 'Coxa', unit: 'cm', sortOrder: 5 },
  ];
  const hip = { typeId: 't-hip', value: 101, name: 'Quadril', unit: 'cm', sortOrder: 4, active: false };

  it('tipos ativos + desativados que ainda têm valor, na ordem do catálogo', () => {
    const cols = measureColumns(types, [m({ values: [hip] })]);
    expect(cols.map((c) => c.label)).toEqual(['Peso', 'Altura', 'Quadril', 'Coxa']);
    expect(cols.find((c) => c.id === 't-hip')?.active).toBe(false);
    expect(measureValue(m({ values: [hip] }), cols[2])).toBe(101);
    expect(measureValue(m({ weightKg: 70 }), cols[0])).toBe(70);
  });

  it('peso e altura aparecem mesmo antes do catálogo carregar', () => {
    expect(measureColumns([], []).map((c) => c.key)).toEqual(['weightKg', 'heightCm']);
  });
});
