import dayjs from 'dayjs';

import type { ApplicationMapPoint, AppointmentKind, AppointmentStatus } from '../../types';

export interface ExtraMaterialRow {
  itemId: string;
  quantity: number;
}

export interface FormValues {
  patientId: string;
  procedureId: string;
  professionalId: string;
  date: string;
  startTime: string;
  status: AppointmentStatus;
  kind: AppointmentKind;
  notes: string;
  clinicalNotes: string;
}

export const emptyFormValues: FormValues = {
  patientId: '',
  procedureId: '',
  professionalId: '',
  date: dayjs().format('YYYY-MM-DD'),
  startTime: '09:00',
  status: 'SCHEDULED',
  kind: 'PROCEDURE',
  notes: '',
  clinicalNotes: '',
};

export type SectionKey =
  | 'patient'
  | 'service'
  | 'schedule'
  | 'package'
  | 'materials'
  | 'applicationMap'
  | 'notes';

export const statusOptions: { value: AppointmentStatus; label: string }[] = [
  { value: 'SCHEDULED', label: 'Agendado' },
  { value: 'CONFIRMED', label: 'Confirmado' },
  { value: 'IN_PROGRESS', label: 'Em atendimento' },
  { value: 'COMPLETED', label: 'Concluído' },
  { value: 'CANCELLED', label: 'Cancelado' },
  { value: 'NO_SHOW', label: 'Faltou' },
];

export const kindOptions: { value: AppointmentKind; label: string }[] = [
  { value: 'EVALUATION', label: 'Avaliação' },
  { value: 'PROCEDURE', label: 'Procedimento' },
  { value: 'RETURN', label: 'Retorno' },
];

export const STATUS_DOT: Record<string, string> = {
  SCHEDULED: '#8B8680',
  CONFIRMED: '#3787DE',
  IN_PROGRESS: '#C98A12',
  COMPLETED: '#15998B',
  CANCELLED: '#C25A4C',
  NO_SHOW: '#D46B8A',
};

export const STATUS_LABEL: Record<string, string> = {
  SCHEDULED: 'Agendado',
  CONFIRMED: 'Confirmado',
  IN_PROGRESS: 'Em andamento',
  COMPLETED: 'Concluído',
  CANCELLED: 'Cancelado',
  NO_SHOW: 'Faltou',
};

export const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function selectValueIfListed(value: string, options: { id: string }[]) {
  if (!value) return '';
  return options.some((o) => o.id === value) ? value : '';
}

export function formatElapsed(secs: number) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function normalizeExtraMaterials(rows: ExtraMaterialRow[]) {
  return rows
    .filter((m) => m.itemId && m.quantity > 0)
    .map((m) => ({ itemId: m.itemId, quantity: Number(m.quantity) }));
}

export function normalizeApplicationMapPoints(points: ApplicationMapPoint[]): ApplicationMapPoint[] {
  return points.map((p) => {
    const note = p.note?.trim();
    return { x: p.x, y: p.y, ...(note ? { note } : {}) };
  });
}
