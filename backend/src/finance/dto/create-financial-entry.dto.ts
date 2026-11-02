import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ExpenseType, FinancialType } from '@prisma/client';

export class CreateFinancialEntryDto {
  @IsEnum(FinancialType)
  type: FinancialType;

  @IsString()
  description: string;

  @IsNumber()
  amount: number;

  @IsOptional()
  @IsUUID()
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

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsDateString()
  paidAt?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsUUID()
  patientId?: string;

  @IsOptional()
  @IsUUID()
  appointmentId?: string;

  @IsOptional()
  @IsUUID()
  equipmentId?: string;

  @IsOptional()
  @IsBoolean()
  invoiceIssued?: boolean;

  @IsOptional()
  @IsEnum(ExpenseType)
  expenseType?: ExpenseType;
}
