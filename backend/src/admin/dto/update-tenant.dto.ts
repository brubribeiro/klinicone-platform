import { Transform } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

import { PLATFORM_FEATURES } from '../../common/platform-features';
import { SLUG_MESSAGE, SLUG_PATTERN, trimToUndefined } from './create-tenant.dto';
import { TenantProfileDto } from './tenant-profile.dto';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class UpdateTenantDto extends TenantProfileDto {
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @Transform(trimToUndefined)
  @IsOptional()
  @Matches(SLUG_PATTERN, { message: SLUG_MESSAGE })
  @MaxLength(60)
  slug?: string;

  /** Troca de plano (só planos ativos); null remove o plano da clínica. */
  @Transform(({ value }) => (value === '' ? null : value))
  @IsOptional()
  @IsUUID('all', { message: 'Plano inválido.' })
  planId?: string | null;

  /** Módulos além do plano; null limpa. */
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn([...PLATFORM_FEATURES], { each: true })
  featuresExtra?: string[] | null;

  /** Módulos do plano removidos nesta clínica; null limpa. */
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn([...PLATFORM_FEATURES], { each: true })
  featuresDenied?: string[] | null;
}

export class SuspendTenantDto {
  /** Motivo (opcional), guardado só na auditoria da plataforma. */
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
