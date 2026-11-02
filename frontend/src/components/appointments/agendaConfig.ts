import { lighten } from '@mui/material';
import type { EventInput } from '@fullcalendar/core';

import type { AppointmentStatus } from '../../types';

export const statusColors: Record<AppointmentStatus, { bg: string; border: string; text: string }> = {
  SCHEDULED: { bg: '#B8E5E2', border: '#0ABAB5', text: '#07807C' },
  CONFIRMED: { bg: '#0ABAB5', border: '#07807C', text: '#FFFFFF' },
  IN_PROGRESS: { bg: '#F9A825', border: '#F57F17', text: '#FFFFFF' },
  COMPLETED: { bg: '#8FBFA8', border: '#5A9A7D', text: '#FFFFFF' },
  CANCELLED: { bg: '#EDEDEB', border: '#A8A6A2', text: '#6E6B66' },
  NO_SHOW: { bg: '#D58A81', border: '#8A3F33', text: '#FFFFFF' },
};

// No tema escuro, eventos em tom pastel (feriados, bloqueios) viram uma tinta da cor da borda com texto claro.
export function toDarkEvent(e: EventInput): EventInput {
  const c = e.borderColor as string;
  return { ...e, backgroundColor: `${c}33`, textColor: lighten(c, 0.6) };
}

export const kindLabel: Record<string, string> = {
  EVALUATION: 'AVAL',
  PROCEDURE: 'PROC',
  RETURN: 'RET',
};

export const statusLabel: Record<string, string> = {
  SCHEDULED: 'Agendado',
  CONFIRMED: 'Confirmado',
  IN_PROGRESS: 'Em andamento',
  COMPLETED: 'Concluído',
  CANCELLED: 'Cancelado',
  NO_SHOW: 'Faltou',
};

export const AGENDA_CATEGORIES = [
  { label: 'Injetáveis', color: '#15998B' },
  { label: 'Laser', color: '#9B7BD4' },
  { label: 'Facial', color: '#5BA8DE' },
  { label: 'Corporal', color: '#E0915B' },
  { label: 'Peeling', color: '#D46B8A' },
];

export const AGENDA_VIEWS = [
  { view: 'timeGridDay', label: 'Dia' },
  { view: 'timeGridWeek', label: 'Semana' },
  { view: 'dayGridMonth', label: 'Mês' },
];

// Cor "de categoria" derivada de forma determinística do nome do procedimento
// (o backend ainda não tem cor por categoria).
export function categoryColorFor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AGENDA_CATEGORIES[h % AGENDA_CATEGORIES.length].color;
}

/** Largura mínima (px) de um agendamento lado a lado na grade de horários para o texto continuar legível. */
export const AGENDA_MIN_EVENT_WIDTH = 64;
// Eixo de horários + paddings do card, descontados da largura do calendário.
const AGENDA_GRID_GUTTER = 70;

/**
 * Quantos agendamentos simultâneos cabem lado a lado numa coluna de dia (`eventMaxStack` do FullCalendar);
 * o excedente vira o link "+N mais".
 */
export function agendaMaxStack(containerWidth: number, view: string): number {
  if (!containerWidth) return 3;
  const columns = view === 'timeGridWeek' ? 7 : 1;
  const columnWidth = (containerWidth - AGENDA_GRID_GUTTER) / columns;
  return Math.min(6, Math.max(1, Math.floor(columnWidth / AGENDA_MIN_EVENT_WIDTH)));
}
