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
export const APPLICATION_MAP_PRODUCTS = [
  'toxin',
  'filler',
  'biostimulator',
  'bioremodeler',
  'skinbooster',
] as const;
/** Imagem em que o ponto foi marcado: rosto (frente, perfis) ou corpo. */
export const APPLICATION_MAP_VIEWS = ['front', 'left', 'right', 'body'] as const;

/** Ponto marcado no diagrama; x/y em % da largura/altura da imagem. */
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

  @IsOptional()
  @IsIn(APPLICATION_MAP_PRODUCTS)
  product?: (typeof APPLICATION_MAP_PRODUCTS)[number];

  /** Quantidade aplicada no ponto, na unidade do produto (U ou ml). */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(9999)
  qty?: number;

  @IsOptional()
  @IsIn(APPLICATION_MAP_VIEWS)
  view?: (typeof APPLICATION_MAP_VIEWS)[number];
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
