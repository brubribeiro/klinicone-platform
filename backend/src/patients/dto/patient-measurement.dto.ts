import { PartialType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  Max,
  ValidateNested,
} from 'class-validator';

export class MeasurementValueDto {
  @IsUUID()
  typeId: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(99999)
  value: number | null;
}

export class CreatePatientMeasurementDto {
  /** Data da medição; sem data, usa a do agendamento vinculado ou agora. */
  @IsOptional()
  @IsDateString()
  measuredAt?: string;

  @IsOptional()
  @IsUUID()
  appointmentId?: string | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  @Max(500)
  weightKg?: number | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(30)
  @Max(260)
  heightCm?: number | null;

  /** Tipos não básicos do catálogo; value null remove o valor. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => MeasurementValueDto)
  values?: MeasurementValueDto[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string | null;
}

export class UpdatePatientMeasurementDto extends PartialType(CreatePatientMeasurementDto) {}
