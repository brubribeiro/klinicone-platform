/**
 * Utilitários de fuso do Brasil (America/Sao_Paulo).
 *
 * O servidor normalmente roda em UTC, então Date.getDay()/getHours()/getMinutes()
 * retornam o horário em UTC, e não o horário de parede visto pelo usuário no Brasil.
 * As funções abaixo extraem o dia da semana e o horário HH:mm sempre no fuso local
 * do Brasil, independente do TZ do processo.
 */

const BRAZIL_TIME_ZONE = 'America/Sao_Paulo';

const partsFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: BRAZIL_TIME_ZONE,
  weekday: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

interface BrazilWallClock {
  /** Dia da semana no fuso do Brasil (0 = domingo … 6 = sábado). */
  dayOfWeek: number;
  /** Horário de parede no formato HH:mm no fuso do Brasil. */
  hhmm: string;
}

export function getBrazilWallClock(date: Date): BrazilWallClock {
  const parts = partsFormatter.formatToParts(date);
  const lookup: Record<string, string> = {};
  for (const part of parts) {
    lookup[part.type] = part.value;
  }
  // Intl pode retornar "24" para meia-noite em alguns ambientes; normaliza para "00".
  const hour = lookup.hour === '24' ? '00' : lookup.hour;
  return {
    dayOfWeek: WEEKDAY_INDEX[lookup.weekday] ?? 0,
    hhmm: `${hour}:${lookup.minute}`,
  };
}

const dateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: BRAZIL_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Dia do calendário no Brasil, como meio-dia UTC (mesmo formato das datas sem horário). */
export function toBrazilDateAtUtcNoon(date: Date): Date {
  return new Date(`${dateFormatter.format(date)}T12:00:00.000Z`);
}

/** Data civil no fuso do Brasil (YYYY-MM-DD + partes numéricas). */
export function getBrazilYmd(date: Date = new Date()): { y: number; m: number; d: number; iso: string } {
  const iso = dateFormatter.format(date);
  const [y, m, d] = iso.split('-').map(Number);
  return { y, m, d, iso };
}

/** Início e fim do dia civil no Brasil (ISO YYYY-MM-DD) como instantes UTC. */
export function brazilDayBoundsUtc(isoDate: string): { from: Date; to: Date } {
  return {
    from: new Date(`${isoDate}T00:00:00-03:00`),
    to: new Date(`${isoDate}T23:59:59.999-03:00`),
  };
}

export function addDaysToIsoDate(isoDate: string, days: number): string {
  const base = new Date(`${isoDate}T12:00:00-03:00`);
  base.setUTCDate(base.getUTCDate() + days);
  return dateFormatter.format(base);
}
