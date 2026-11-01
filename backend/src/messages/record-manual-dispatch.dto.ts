import { IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class RecordManualDispatchDto {
  @IsUUID()
  templateId: string;

  @IsUUID()
  patientId: string;

  @IsOptional()
  @IsUUID()
  appointmentId?: string | null;

  @IsOptional()
  @IsString()
  phone?: string | null;

  @IsString()
  @MinLength(1)
  renderedMessage: string;
}
