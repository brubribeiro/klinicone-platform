import dayjs, { type Dayjs } from 'dayjs';
import 'dayjs/locale/pt-br';

import type { WorkingHours } from '../../types';
import { DAY_ABBR, DEFAULT_DAY, WEEK_ORDER, WEEK_PRESETS, type DayScheduleEdit } from './availabilityConfig';

export function initialsOf(name: string): string {
  // Ignora títulos como "Dra." / "Enf." ao montar as iniciais.
  const words = name.split(/\s+/).filter((w) => w && !w.endsWith('.'));
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

export function buildWeekFromRemote(remote: WorkingHours[]): Record<number, DayScheduleEdit> {
  const result: Record<number, DayScheduleEdit> = {};
  for (let day = 0; day < 7; day++) {
    const wh = remote.find((w) => w.dayOfWeek === day);
    result[day] = wh
      ? { works: true, startTime: wh.startTime, endTime: wh.endTime }
      : { ...DEFAULT_DAY };
  }
  return result;
}

export function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
}

/** Resumo dos dias abertos (ex.: "Seg – Sex", "Seg, Qua, Sex"). */
export function summarizeDays(hours: WorkingHours[]): string {
  const open = WEEK_ORDER.filter((d) => hours.some((h) => h.dayOfWeek === d));
  if (open.length === 0) return 'Sem horário definido';
  const idx = open.map((d) => WEEK_ORDER.indexOf(d));
  const contiguous = idx.every((v, i) => i === 0 || v === idx[i - 1] + 1);
  if (contiguous && open.length >= 3) {
    return `${DAY_ABBR[open[0]]} – ${DAY_ABBR[open[open.length - 1]]}`;
  }
  return open.map((d) => DAY_ABBR[d]).join(', ');
}

/** Faixa de horário da semana e uma nota (carga semanal ou "varia por dia"). */
export function summarizeHours(hours: WorkingHours[]): { range: string; note: string } | null {
  if (hours.length === 0) return null;
  const starts = hours.map((h) => h.startTime).sort();
  const ends = hours.map((h) => h.endTime).sort();
  const uniform = starts[0] === starts[starts.length - 1] && ends[0] === ends[ends.length - 1];
  const weekly = hours.reduce((sum, h) => sum + toMinutes(h.endTime) - toMinutes(h.startTime), 0);
  return {
    range: `${starts[0]} – ${ends[ends.length - 1]}`,
    note: uniform ? `${formatMinutes(weekly)} por semana` : 'varia por dia',
  };
}

export function isFullDayRange(startAt: string, endAt: string): boolean {
  const start = dayjs(startAt);
  const end = dayjs(endAt);
  return (
    start.isSame(start.startOf('day'), 'minute') &&
    end.isSame(end.endOf('day'), 'minute')
  );
}

export function formatUnavailabilityPeriod(startAt: string, endAt: string): string {
  const start = dayjs(startAt);
  const end = dayjs(endAt);
  if (isFullDayRange(startAt, endAt)) {
    if (start.isSame(end, 'day')) {
      return `${start.format('DD/MM/YYYY')} · dia inteiro`;
    }
    return `${start.format('DD/MM/YYYY')} → ${end.format('DD/MM/YYYY')} · dias inteiros`;
  }
  return `${start.format('DD/MM/YYYY HH:mm')} → ${end.format('DD/MM/YYYY HH:mm')}`;
}

/** Formato curto da lista de bloqueios (ex.: "25 – 27 jun", "19 jun · 12:00 – 14:00"). */
export function formatBlockPeriod(startAt: string, endAt: string): string {
  const start = dayjs(startAt).locale('pt-br');
  const end = dayjs(endAt).locale('pt-br');
  const day = (d: Dayjs) => d.format(d.isSame(dayjs(), 'year') ? 'D MMM' : 'D MMM YYYY');
  if (isFullDayRange(startAt, endAt)) {
    if (start.isSame(end, 'day')) return day(start);
    if (start.isSame(end, 'month')) return `${start.format('D')} – ${day(end)}`;
    return `${day(start)} – ${day(end)}`;
  }
  if (start.isSame(end, 'day')) {
    return `${day(start)} · ${start.format('HH:mm')} – ${end.format('HH:mm')}`;
  }
  return `${day(start)} ${start.format('HH:mm')} – ${day(end)} ${end.format('HH:mm')}`;
}

export function nextWeekdayRange(weekdayStart: number, weekdayEnd: number) {
  const today = dayjs();
  let start = today;
  while (start.day() !== weekdayStart) {
    start = start.add(1, 'day');
  }
  let end = start;
  while (end.day() !== weekdayEnd) {
    end = end.add(1, 'day');
  }
  return { start: start.format('YYYY-MM-DD'), end: end.format('YYYY-MM-DD') };
}

/** Atalho semanal que corresponde à grade atual (para destacar no ToggleButtonGroup). */
export function detectWeekPreset(schedule: Record<number, DayScheduleEdit>): string | null {
  for (const preset of WEEK_PRESETS) {
    let match = true;
    for (let day = 0; day < 7; day++) {
      const works = schedule[day]?.works ?? false;
      if (works !== preset.days.includes(day)) {
        match = false;
        break;
      }
    }
    if (match) return preset.label;
  }
  return null;
}

/** Mensagem da API (`response.data.message`) ou o texto padrão. */
export function apiMessageOf(error: unknown, fallback: string): string {
  return (error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback;
}
