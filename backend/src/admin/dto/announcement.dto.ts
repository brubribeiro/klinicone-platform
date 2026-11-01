import { Transform } from 'class-transformer';
import { AnnouncementKind, AnnouncementStatus } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export const ANNOUNCEMENT_BODY_MAX = 4000;

export class CreateAnnouncementDto {
  @Transform(trim)
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  title: string;

  @Transform(trim)
  @IsString()
  @MinLength(3)
  @MaxLength(ANNOUNCEMENT_BODY_MAX)
  body: string;

  @IsEnum(AnnouncementKind)
  kind: AnnouncementKind;
}

export class UpdateAnnouncementDto {
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  title?: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(ANNOUNCEMENT_BODY_MAX)
  body?: string;

  @IsOptional()
  @IsEnum(AnnouncementKind)
  kind?: AnnouncementKind;
}

export class ScheduleAnnouncementDto {
  /** ISO 8601 com fuso (o front manda toISOString do horário local escolhido). */
  @IsDateString()
  scheduledAt: string;
}

export class AnnouncementQueryDto {
  @IsOptional()
  @IsEnum(AnnouncementStatus)
  status?: AnnouncementStatus;
}
