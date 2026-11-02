import type { MeasurementType, PatientMeasurement } from '../../types';
import { calcIMC } from './anamnesisFields';

/** Coluna do card/formulário: tipo do catálogo (peso e altura gravam nas colunas `key`). */
export interface MeasureColumn {
  id: string;
  key: MeasurementType['key'];
  label: string;
  unit: string;
  sortOrder: number;
  active: boolean;
}

// Peso e altura não podem ser desativados; garantem o básico enquanto o catálogo carrega
const BASIC_COLUMNS: MeasureColumn[] = [
  { id: 'weightKg', key: 'weightKg', label: 'Peso', unit: 'kg', sortOrder: 0, active: true },
  { id: 'heightCm', key: 'heightCm', label: 'Altura', unit: 'cm', sortOrder: 1, active: true },
];

/**
 * Tipos ativos do catálogo + tipos desativados que ainda têm valor nas medições
 * (o histórico não some quando o admin desativa uma medida).
 */
export function measureColumns(types: MeasurementType[], measurements: PatientMeasurement[]): MeasureColumn[] {
  const columns = new Map<string, MeasureColumn>();
  for (const basic of BASIC_COLUMNS) {
    const type = types.find((t) => t.key === basic.key);
    columns.set(basic.id, type ? { ...basic, label: type.name, unit: type.unit, sortOrder: type.sortOrder } : basic);
  }
  for (const t of types) {
    if (!t.key) columns.set(t.id, { id: t.id, key: null, label: t.name, unit: t.unit, sortOrder: t.sortOrder, active: true });
  }
  for (const m of measurements) {
    for (const v of m.values ?? []) {
      if (!columns.has(v.typeId)) {
        columns.set(v.typeId, { id: v.typeId, key: null, label: v.name, unit: v.unit, sortOrder: v.sortOrder, active: v.active });
      }
    }
  }
  return [...columns.values()].sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label));
}

export function measureValue(m: PatientMeasurement, column: MeasureColumn): number | null {
  if (column.key) return m[column.key];
  return m.values?.find((v) => v.typeId === column.id)?.value ?? null;
}

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
