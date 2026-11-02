import { Transform } from 'class-transformer';
import { IsEmail, IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength } from 'class-validator';

import { TenantProfileDto } from './tenant-profile.dto';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export const trimToUndefined = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || undefined : value;

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const SLUG_MESSAGE = 'Identificador deve ter só letras minúsculas, números e hífens (ex.: clinica-bela).';

export class CreateTenantDto extends TenantProfileDto {
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  /** Identificador único da clínica; gerado a partir do nome se vazio. */
  @Transform(trimToUndefined)
  @IsOptional()
  @Matches(SLUG_PATTERN, { message: SLUG_MESSAGE })
  @MaxLength(60)
  slug?: string;

  /** Primeiro usuário da clínica (grupo Administrador); entra com o Google deste e-mail. */
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  adminName: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: 'E-mail do administrador inválido.' })
  adminEmail: string;

  /** Plano da clínica (opcional; só planos ativos). */
  @Transform(trimToUndefined)
  @IsOptional()
  @IsUUID('all', { message: 'Plano inválido.' })
  planId?: string;
}
