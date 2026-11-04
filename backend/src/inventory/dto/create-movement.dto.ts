import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, Min, ValidateIf } from 'class-validator';
import { Type } from 'class-transformer';
import { MovementType } from '@prisma/client';

export class CreateMovementDto {
  @IsEnum(MovementType)
  type: MovementType;

  /** Entrada/saída: quantidade movimentada (> 0). Ajuste: novo total do item (pode ser 0). */
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  quantity: number;

  @IsOptional()
  @IsString()
  reason?: string;

  /** Obrigatório para entradas (IN) — cada lote pode ter validade diferente. */
  @IsOptional()
  @ValidateIf((o) => o.type === MovementType.IN)
  @IsDateString()
  expiresAt?: string;

  /** Valor total da compra — obrigatório em entradas; gera despesa no financeiro. */
  @IsOptional()
  @ValidateIf((o) => o.type === MovementType.IN)
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  totalPrice?: number;
}
