import { PartialType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, ValidateNested } from 'class-validator';

import { ApplicationMapDto } from './application-map.dto';
import { CreateAppointmentDto } from './create-appointment.dto';

export class UpdateAppointmentDto extends PartialType(CreateAppointmentDto) {
  /** ID da forma de pagamento — informado ao concluir o agendamento */
  @IsOptional()
  @IsString()
  paymentMethodId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(24)
  installments?: number;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  cardBrand?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  authorizationCode?: string;

  /**
   * Mês de competência da receita (formato "YYYY-MM"). Usado para lançar
   * agendamentos antigos no mês financeiro correto. Se ausente, usa a data atual.
   */
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}$/, { message: 'referenceMonth deve estar no formato YYYY-MM' })
  referenceMonth?: string;

  /** Mapa de aplicação marcado no atendimento; lista vazia apaga o mapa. */
  @IsOptional()
  @ValidateNested()
  @Type(() => ApplicationMapDto)
  applicationMap?: ApplicationMapDto;
}
