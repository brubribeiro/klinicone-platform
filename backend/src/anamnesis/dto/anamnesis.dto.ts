import { PartialType } from '@nestjs/mapped-types';
import { AnamnesisKind, AnamnesisQuestionType } from '@prisma/client';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class ListAnamnesisQuestionsQueryDto {
  @IsEnum(AnamnesisKind)
  kind: AnamnesisKind;
}

export class CreateAnamnesisQuestionDto {
  @IsEnum(AnamnesisKind)
  kind: AnamnesisKind;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  label: string;

  @IsEnum(AnamnesisQuestionType)
  type: AnamnesisQuestionType;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  options?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(80)
  section?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  placeholder?: string | null;

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdateAnamnesisQuestionDto extends PartialType(CreateAnamnesisQuestionDto) {
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class ReorderAnamnesisQuestionsDto {
  @IsEnum(AnamnesisKind)
  kind: AnamnesisKind;

  @IsArray()
  @ArrayMaxSize(200)
  @IsUUID('all', { each: true })
  ids: string[];
}

export class CreateAnamnesisLinkDto {
  @IsUUID()
  patientId: string;
}

export class SubmitPublicAnamnesisDto {
  @IsObject()
  answers: Record<string, unknown>;
}
