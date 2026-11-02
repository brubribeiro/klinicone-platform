import type { PatientMeasurement } from '../../types';
import { calcIMC } from './anamnesisFields';

export type MeasureKey = 'weightKg' | 'heightCm' | 'waistCm' | 'abdomenCm' | 'hipCm';

export const MEASURE_FIELDS: { key: MeasureKey; label: string; unit: string }[] = [
  { key: 'weightKg', label: 'Peso', unit: 'kg' },
  { key: 'heightCm', label: 'Altura', unit: 'cm' },
  { key: 'waistCm', label: 'Cintura', unit: 'cm' },
  { key: 'abdomenCm', label: 'Abdômen', unit: 'cm' },
  { key: 'hipCm', label: 'Quadril', unit: 'cm' },
];

export type ChartMetric = Exclude<MeasureKey, 'heightCm'> | 'imc';

export const CHART_METRICS: { key: ChartMetric; label: string; unit: string }[] = [
  { key: 'weightKg', label: 'Peso', unit: 'kg' },
  { key: 'imc', label: 'IMC', unit: '' },
  { key: 'waistCm', label: 'Cintura', unit: 'cm' },
  { key: 'abdomenCm', label: 'Abdômen', unit: 'cm' },
  { key: 'hipCm', label: 'Quadril', unit: 'cm' },
];

/** Altura da própria medição ou, se ausente, a mais recente informada antes dela (lista em ordem cronológica). */
export function withImc(chronological: PatientMeasurement[]) {
  let lastHeight: number | null = null;
  return chronological.map((m) => {
    if (m.heightCm != null) lastHeight = m.heightCm;
    return { ...m, imc: calcIMC(m.weightKg, lastHeight) };
  });
}

export function formatMeasure(value: number | null | undefined, unit = '') {
  if (value == null) return '—';
  const text = value.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
  return unit ? `${text} ${unit}` : text;
}
