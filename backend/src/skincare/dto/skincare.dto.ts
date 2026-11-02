import { PartialType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';

import { SKINCARE_MOMENTS, SKINCARE_RULE_FIELDS, SKINCARE_STEPS } from '../skincare.constants';

export class CreateSkincareProductDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  brand?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  activeIngredient?: string | null;

  @IsArray()
  @ArrayMinSize(1)
  @IsIn(SKINCARE_MOMENTS, { each: true })
  moments: string[];

  @IsIn(SKINCARE_STEPS)
  step: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  tags?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  howTo?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string | null;
}

export class UpdateSkincareProductDto extends PartialType(CreateSkincareProductDto) {}

export class CreateSkincareRuleDto {
  @IsIn(SKINCARE_RULE_FIELDS)
  field: string;

  @IsString()
  @IsNotEmpty()
  value: string;

  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  productIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  avoidTags?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string | null;
}

export class UpdateSkincareRuleDto extends PartialType(CreateSkincareRuleDto) {}

export class SkincareRoutineItemDto {
  @IsIn(SKINCARE_MOMENTS)
  moment: string;

  @IsIn(SKINCARE_STEPS)
  step: string;

  @IsOptional()
  @IsString()
  productId?: string | null;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

  @IsOptional()
  @IsString()
  brand?: string | null;

  @IsOptional()
  @IsString()
  activeIngredient?: string | null;

  @IsOptional()
  @IsString()
  howTo?: string | null;

  @IsOptional()
  @IsString()
  note?: string | null;
}

export class SkincareAvoidedDto {
  @IsOptional()
  @IsString()
  productId?: string | null;

  @IsString()
  name: string;

  @IsString()
  reason: string;
}

export class SkincareGuidelineDto {
  @IsString()
  text: string;

  @IsOptional()
  @IsString()
  source?: string;
}

export class CreateSkincareRoutineDto {
  @IsUUID()
  patientId: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  consultDate: string;

  /** Respostas da anamnese: { pele, afec[], afecOutra, olheira, olheiraTipo, idade } */
  @IsObject()
  answers: Record<string, unknown>;

  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => SkincareRoutineItemDto)
  items: SkincareRoutineItemDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SkincareAvoidedDto)
  avoided?: SkincareAvoidedDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SkincareGuidelineDto)
  guidelines?: SkincareGuidelineDto[];

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string | null;
}

export class UpdateSkincareRoutineDto extends PartialType(CreateSkincareRoutineDto) {}
