/** Catálogo fixo de especialidades da clínica (painel super-admin). */
export const CLINIC_SPECIALTIES = [
  'facial',
  'corporal',
  'laser',
  'injetaveis',
  'skincare',
  'capilar',
  'dermatologia',
  'harmonizacao',
  'nutricao',
  'spa',
] as const;

export type ClinicSpecialty = (typeof CLINIC_SPECIALTIES)[number];

const SPECIALTY_SET = new Set<string>(CLINIC_SPECIALTIES);

export function isClinicSpecialty(value: string): value is ClinicSpecialty {
  return SPECIALTY_SET.has(value);
}

export function normalizeSpecialties(value: unknown): ClinicSpecialty[] {
  if (!Array.isArray(value)) return [];
  const out: ClinicSpecialty[] = [];
  for (const item of value) {
    const s = typeof item === 'string' ? item.trim() : '';
    if (isClinicSpecialty(s) && !out.includes(s)) out.push(s);
  }
  return out;
}
