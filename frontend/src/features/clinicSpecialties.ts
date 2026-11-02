/** Espelha backend/src/common/clinic-specialties.ts */

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

export const CLINIC_SPECIALTY_LABELS: Record<ClinicSpecialty, string> = {
  facial: 'Estética facial',
  corporal: 'Estética corporal',
  laser: 'Laser',
  injetaveis: 'Injetáveis',
  skincare: 'Skincare',
  capilar: 'Capilar',
  dermatologia: 'Dermatologia estética',
  harmonizacao: 'Harmonização',
  nutricao: 'Nutrição estética',
  spa: 'Spa & bem-estar',
};

export function specialtyLabels(specialties: string[] | null | undefined): string[] {
  if (!specialties?.length) return [];
  return specialties
    .filter((s): s is ClinicSpecialty => s in CLINIC_SPECIALTY_LABELS)
    .map((s) => CLINIC_SPECIALTY_LABELS[s]);
}

export function formatSpecialtiesList(specialties: string[] | null | undefined): string {
  return specialtyLabels(specialties).join(', ');
}
