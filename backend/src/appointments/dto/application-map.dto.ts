import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsHexColor,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
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
  'cryolipolysis',
] as const;
/**
 * Imagem em que o ponto foi marcado: rosto (frente, perfis), corpo, a foto da paciente
 * (`photo`, também usada pelo modelo 3D: a malha usa a foto como textura, então o ponto
 * marcado no 3D é gravado nas coordenadas da foto) ou o mapa ilustrado de uma região do
 * rosto (o id da vista é o da região: `lips`, `nose`…).
 */
export const APPLICATION_MAP_FACE_REGION_VIEWS = [
  'forehead',
  'temples',
  'periorbital',
  'nose',
  'malar',
  'nasolabial',
  'lips',
  'chin',
  'jawline',
] as const;
export const APPLICATION_MAP_VIEWS = [
  'front',
  'left',
  'right',
  'body',
  'photo',
  ...APPLICATION_MAP_FACE_REGION_VIEWS,
] as const;
/** Região ampliada em que o ponto foi marcado (rosto para preenchimento, corpo para criolipólise). */
export const APPLICATION_MAP_REGIONS = [
  ...APPLICATION_MAP_FACE_REGION_VIEWS,
  'submental',
  'arms',
  'abdomen',
  'flanks',
  'back',
  'saddlebags',
  'thighs',
] as const;

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

  /** Quantidade aplicada no ponto, na unidade do produto (U, ml ou ciclos). */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(9999)
  qty?: number;

  @IsOptional()
  @IsIn(APPLICATION_MAP_VIEWS)
  view?: (typeof APPLICATION_MAP_VIEWS)[number];

  @IsOptional()
  @IsIn(APPLICATION_MAP_REGIONS)
  region?: (typeof APPLICATION_MAP_REGIONS)[number];
}

/** Traço de desenho livre; `points` = [x1, y1, x2, y2, …] em % da imagem. */
export class ApplicationMapStrokeDto {
  @IsIn(APPLICATION_MAP_VIEWS)
  view: (typeof APPLICATION_MAP_VIEWS)[number];

  @IsHexColor()
  color: string;

  /** Espessura em % da largura da imagem. */
  @IsNumber()
  @Min(0.1)
  @Max(5)
  width: number;

  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(1000)
  @IsNumber({}, { each: true })
  @Min(0, { each: true })
  @Max(100, { each: true })
  points: number[];
}

export class ApplicationMapDto {
  @IsIn(APPLICATION_MAP_TEMPLATES)
  template: (typeof APPLICATION_MAP_TEMPLATES)[number];

  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => ApplicationMapPointDto)
  points: ApplicationMapPointDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ApplicationMapStrokeDto)
  strokes?: ApplicationMapStrokeDto[];

  /** Foto da paciente (PatientPhoto, no R2) usada na vista `photo` e no modelo 3D. */
  @IsOptional()
  @IsUUID()
  photoId?: string;
}
