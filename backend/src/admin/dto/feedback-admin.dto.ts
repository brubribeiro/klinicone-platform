import { Type } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min } from 'class-validator';
import { FeedbackStatus, FeedbackType } from '@prisma/client';

import { OBSERVABILITY_WINDOWS_HOURS } from '../observability.service';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DATE_MESSAGE = 'Data inválida (use AAAA-MM-DD).';

/** Período (dias do Brasil) e clínica do painel de uso. */
export class UsageQueryDto {
  @IsOptional()
  @Matches(DATE_PATTERN, { message: DATE_MESSAGE })
  from?: string;

  @IsOptional()
  @Matches(DATE_PATTERN, { message: DATE_MESSAGE })
  to?: string;

  @IsOptional()
  @IsUUID()
  tenantId?: string;
}

export class FeedbackAdminQueryDto extends UsageQueryDto {
  @IsOptional()
  @IsEnum(FeedbackType)
  type?: FeedbackType;

  @IsOptional()
  @IsEnum(FeedbackStatus)
  status?: FeedbackStatus;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class UpdateFeedbackStatusDto {
  @IsEnum(FeedbackStatus)
  status!: FeedbackStatus;
}

/** Janela do painel de saúde da API (24 h, 7 dias ou 30 dias). */
export class ObservabilityQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsIn(OBSERVABILITY_WINDOWS_HOURS)
  hours?: number;
}
