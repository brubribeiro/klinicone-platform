import { getBrazilYmd } from './brazil-time.util';

export interface TemplateVars {
  paciente_nome?: string;
  procedimento?: string;
  data?: string;
  hora?: string;
  profissional?: string;
  clinica?: string;
}

export function onlyDigits(value: string): string {
  return value.replace(/\D/g, '');
}

export function renderMessageTemplate(content: string, vars: TemplateVars): string {
  const all: Record<string, string | undefined> = { nome: vars.paciente_nome, ...vars };
  return content.replace(/\{(\w+)\}/g, (_, key: string) => {
    const v = all[key];
    return v != null ? String(v) : '';
  });
}

export function whatsappMeUrl(phone: string, message: string): string | null {
  let digits = onlyDigits(phone);
  if (digits.length < 10) return null;
  if (digits.length === 10 || digits.length === 11) {
    digits = `55${digits}`;
  }
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function formatBrazilDateTime(date: Date): { data: string; hora: string } {
  const { y, m, d } = getBrazilYmd(date);
  const parts = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const lookup: Record<string, string> = {};
  for (const part of parts) {
    lookup[part.type] = part.value;
  }
  const hour = lookup.hour === '24' ? '00' : lookup.hour;
  return {
    data: `${pad2(d)}/${pad2(m)}/${y}`,
    hora: `${hour}:${lookup.minute}`,
  };
}

export function firstName(fullName?: string | null): string | undefined {
  if (!fullName?.trim()) return undefined;
  return fullName.trim().split(/\s+/)[0];
}

export function varsFromAppointmentRow(appt: {
  patient?: { name?: string | null };
  procedure?: { name?: string | null } | null;
  professional?: { name?: string | null };
  startAt: Date;
  clinica?: string;
}): TemplateVars {
  const { data, hora } = formatBrazilDateTime(appt.startAt);
  return {
    paciente_nome: firstName(appt.patient?.name),
    procedimento: appt.procedure?.name ?? undefined,
    data,
    hora,
    profissional: firstName(appt.professional?.name),
    clinica: appt.clinica,
  };
}
