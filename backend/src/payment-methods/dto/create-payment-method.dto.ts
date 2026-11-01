import { PaymentMethodKind } from '@prisma/client';
import { IsString, IsOptional, IsNumber, IsBoolean, Min, Max, IsEnum, IsInt } from 'class-validator';

export class CreatePaymentMethodDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsEnum(PaymentMethodKind)
  kind?: PaymentMethodKind;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(365)
  settlementDays?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  feePercent?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
