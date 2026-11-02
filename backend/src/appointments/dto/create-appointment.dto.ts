import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AppointmentStatus, AppointmentKind } from '@prisma/client';

import { AppointmentMaterialDto } from './appointment-material.dto';

export class CreateAppointmentDto {
  @IsUUID()
  patientId: string;

  @IsOptional()
  @IsUUID()
  procedureId?: string;

  /** Vários procedimentos no mesmo horário (duração somada). Tem prioridade sobre `procedureId`. */
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  procedureIds?: string[];

  @IsUUID()
  professionalId: string;

  @IsDateString()
  startAt: string;

  @IsDateString()
  endAt: string;

  @IsOptional()
  @IsEnum(AppointmentStatus)
  status?: AppointmentStatus;

  @IsOptional()
  @IsEnum(AppointmentKind)
  kind?: AppointmentKind;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  clinicalNotes?: string;

  @IsOptional()
  @IsUUID()
  patientPackageId?: string;

  /** Materiais extras além do previsto no procedimento */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AppointmentMaterialDto)
  extraMaterials?: AppointmentMaterialDto[];
}
