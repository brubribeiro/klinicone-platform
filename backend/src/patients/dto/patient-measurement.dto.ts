import { PartialType } from '@nestjs/mapped-types';
import { IsDateString, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min, Max } from 'class-validator';

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

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(10)
  @Max(400)
  waistCm?: number | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(10)
  @Max(400)
  abdomenCm?: number | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(10)
  @Max(400)
  hipCm?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string | null;
}

export class UpdatePatientMeasurementDto extends PartialType(CreatePatientMeasurementDto) {}
