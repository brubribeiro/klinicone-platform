import { Transform } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsDateString,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { Prisma } from '@prisma/client';

import { CLINIC_SPECIALTIES, normalizeSpecialties } from '../../common/clinic-specialties';

const trimToUndefined = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || undefined : value;

/** Limpa string vazia; em updates, string vazia vira null (limpar campo). */
export const trimToNull = ({ value }: { value: unknown }) => {
  if (value === null || value === undefined) return value;
  if (typeof value !== 'string') return value;
  const t = value.trim();
  return t === '' ? null : t;
};

export const CNPJ_DIGITS_MESSAGE = 'CNPJ deve ter 14 dígitos.';

export function normalizeCnpj(value: unknown): string | undefined | null {
  if (value === null) return null;
  if (typeof value !== 'string') return undefined;
  const digits = value.replace(/\D/g, '');
  return digits === '' ? undefined : digits;
}

/** Campos de perfil da clínica (create e update no painel super-admin). */
export class TenantProfileDto {
  @Transform(({ value }) => (value === null ? null : normalizeSpecialties(value)))
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn([...CLINIC_SPECIALTIES], { each: true })
  specialties?: string[] | null;

  @Transform(trimToNull)
  @IsOptional()
  @IsDateString()
  foundedAt?: string | null;

  @Transform(trimToNull)
  @IsOptional()
  @IsString()
  @MaxLength(160)
  legalName?: string | null;

  @Transform(({ value }) => normalizeCnpj(value))
  @IsOptional()
  @Matches(/^\d{14}$/, { message: CNPJ_DIGITS_MESSAGE })
  document?: string | null;

  @Transform(trimToNull)
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string | null;

  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() || null : value,
  )
  @IsOptional()
  @IsEmail({}, { message: 'E-mail de contato inválido.' })
  email?: string | null;

  @Transform(trimToNull)
  @IsOptional()
  @IsString()
  @MaxLength(80)
  city?: string | null;

  @Transform(({ value }) => {
    if (value === null || value === undefined) return value;
    if (typeof value !== 'string') return value;
    const t = value.trim().toUpperCase();
    return t === '' ? null : t;
  })
  @IsOptional()
  @Matches(/^[A-Z]{2}$/, { message: 'UF deve ter 2 letras.' })
  state?: string | null;

  @Transform(trimToNull)
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;
}

export type TenantProfileInput = Pick<
  TenantProfileDto,
  'specialties' | 'foundedAt' | 'legalName' | 'document' | 'phone' | 'email' | 'city' | 'state' | 'notes'
>;

export function tenantProfilePrismaData(
  dto: Partial<TenantProfileInput>,
  mode: 'create' | 'update',
): Record<string, string | Date | Prisma.InputJsonValue | typeof Prisma.DbNull | null | undefined> {
  const out: Record<string, string | Date | Prisma.InputJsonValue | typeof Prisma.DbNull | null | undefined> = {};
  const keys: (keyof TenantProfileInput)[] = [
    'legalName',
    'document',
    'phone',
    'email',
    'city',
    'state',
    'notes',
  ];
  for (const key of keys) {
    if (!(key in dto)) continue;
    const val = dto[key];
    if (mode === 'create' && (val === undefined || val === null)) continue;
    out[key] = val ?? null;
  }
  if ('specialties' in dto && dto.specialties !== undefined) {
    const list = normalizeSpecialties(dto.specialties);
    if (mode === 'create') {
      if (list.length) out.specialties = list;
    } else {
      out.specialties = list.length ? list : Prisma.DbNull;
    }
  }
  if ('foundedAt' in dto) {
    const val = dto.foundedAt;
    if (mode === 'create' && !val) {
      // skip
    } else if (!val) {
      out.foundedAt = null;
    } else {
      const ymd = val.split('T')[0];
      out.foundedAt = new Date(`${ymd}T12:00:00.000Z`);
    }
  }
  return out;
}
