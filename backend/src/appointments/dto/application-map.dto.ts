import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export const APPLICATION_MAP_TEMPLATES = ['face'] as const;

/** Ponto marcado no diagrama; x/y em % da largura/altura do desenho. */
export class ApplicationMapPointDto {
  @IsNumber()
  @Min(0)
  @Max(100)
  x: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  y: number;

  /** Produto, dose ou observação do ponto (ex.: "Toxina 4U") */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  note?: string;
}

export class ApplicationMapDto {
  @IsIn(APPLICATION_MAP_TEMPLATES)
  template: (typeof APPLICATION_MAP_TEMPLATES)[number];

  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => ApplicationMapPointDto)
  points: ApplicationMapPointDto[];
}
