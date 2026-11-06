import faceFrontSrc from '../../assets/application-map/face-frente.webp';
import faceLeftSrc from '../../assets/application-map/face-perfil-e.webp';
import faceRightSrc from '../../assets/application-map/face-perfil-d.webp';
import bodySrc from '../../assets/application-map/corpo.webp';
import foreheadSrc from '../../assets/application-map/regioes/testa.svg';
import templesSrc from '../../assets/application-map/regioes/temporas.svg';
import periorbitalSrc from '../../assets/application-map/regioes/olhos.svg';
import noseSrc from '../../assets/application-map/regioes/nariz.svg';
import malarSrc from '../../assets/application-map/regioes/malar.svg';
import nasolabialSrc from '../../assets/application-map/regioes/nasogeniano.svg';
import lipsSrc from '../../assets/application-map/regioes/labios.svg';
import chinSrc from '../../assets/application-map/regioes/mento.svg';
import jawlineSrc from '../../assets/application-map/regioes/mandibula.svg';
import type {
  ApplicationMap,
  ApplicationMapFaceRegion,
  ApplicationMapPoint,
  ApplicationMapProduct,
  ApplicationMapRegion,
  ApplicationMapStroke,
  ApplicationMapView,
} from '../../types';

export interface MapProductDef {
  id: ApplicationMapProduct;
  label: string;
  color: string;
  unit: 'U' | 'ml' | 'ciclos';
}

export const MAP_PRODUCTS: MapProductDef[] = [
  { id: 'toxin', label: 'Toxina Botulínica', color: '#15998B', unit: 'U' },
  { id: 'filler', label: 'Preenchimento', color: '#9B7BD4', unit: 'ml' },
  { id: 'biostimulator', label: 'Bioestimulador', color: '#5BA8DE', unit: 'ml' },
  { id: 'bioremodeler', label: 'Bioremodelador', color: '#E0915B', unit: 'ml' },
  { id: 'skinbooster', label: 'Skinbooster', color: '#D46B8A', unit: 'ml' },
  { id: 'cryolipolysis', label: 'Criolipólise', color: '#4C6EF5', unit: 'ciclos' },
];

const PRODUCT_BY_ID = new Map(MAP_PRODUCTS.map((p) => [p.id, p]));

export function productDef(id?: ApplicationMapProduct): MapProductDef | undefined {
  return id ? PRODUCT_BY_ID.get(id) : undefined;
}

export interface MapViewDef {
  label: string;
  src: string;
  width: number;
  height: number;
}

/** Vistas ilustradas; a vista `photo` usa a foto da paciente e é montada na hora. */
export type IllustratedView = Exclude<ApplicationMapView, 'photo'>;

/** Ponto de aplicação sugerido num mapa de região; x/y em % da imagem. */
export interface MapGuide {
  x: number;
  y: number;
  label: string;
}

/** Região do rosto com mapa ilustrado próprio (anatomia + pontos sugeridos). */
export interface FaceRegionMap {
  id: ApplicationMapFaceRegion;
  label: string;
  image: MapViewDef;
  guides: MapGuide[];
}

const REGION_W = 800;
const REGION_H = 560;
const regionImage = (label: string, src: string): MapViewDef => ({ label, src, width: REGION_W, height: REGION_H });
/** Ponto sugerido nos dois lados da linha média. */
const pair = (x: number, y: number, label: string): MapGuide[] => [
  { x, y, label },
  { x: 100 - x, y, label },
];

/**
 * Mapas ilustrados por região (preenchimento, toxina…): cada um tem a anatomia rotulada e
 * pontos sugeridos; os pontos marcados ficam na vista da própria região.
 */
export const FACE_REGIONS: FaceRegionMap[] = [
  {
    id: 'forehead',
    label: 'Testa e glabela',
    image: regionImage('Testa e glabela', foreheadSrc),
    guides: [
      ...pair(31.25, 33.9, 'Frontal'),
      ...pair(40.6, 32.1, 'Frontal'),
      { x: 50, y: 31.4, label: 'Frontal' },
      { x: 50, y: 66.4, label: 'Prócero' },
      ...pair(43.25, 61.8, 'Corrugador'),
      ...pair(23.75, 62.5, 'Cauda da sobrancelha'),
    ],
  },
  {
    id: 'temples',
    label: 'Têmporas',
    image: regionImage('Têmporas', templesSrc),
    guides: [
      { x: 42.5, y: 35.7, label: 'Fossa temporal superior' },
      { x: 49.4, y: 43.75, label: 'Fossa temporal' },
      { x: 45, y: 54.5, label: 'Fossa temporal inferior' },
    ],
  },
  {
    id: 'periorbital',
    label: 'Olheiras',
    image: regionImage('Olheiras e região periorbital', periorbitalSrc),
    guides: [
      { x: 34.4, y: 55.7, label: 'Sulco lacrimal medial' },
      { x: 40.6, y: 60.4, label: 'Sulco lacrimal' },
      { x: 48.1, y: 62.5, label: 'Sulco lacrimal lateral' },
      { x: 58.75, y: 61.1, label: 'Sulco palpebromalar' },
      { x: 77.75, y: 31.8, label: 'Pés de galinha' },
      { x: 80, y: 38.9, label: 'Pés de galinha' },
      { x: 77.75, y: 46.8, label: 'Pés de galinha' },
    ],
  },
  {
    id: 'nose',
    label: 'Nariz',
    image: regionImage('Nariz (perfil)', noseSrc),
    guides: [
      { x: 61.5, y: 21.8, label: 'Radix' },
      { x: 50.5, y: 42.9, label: 'Dorso' },
      { x: 40.25, y: 59.8, label: 'Supra-ponta' },
      { x: 36, y: 68.6, label: 'Ponta' },
      { x: 50.25, y: 75.7, label: 'Espinha nasal (base da columela)' },
    ],
  },
  {
    id: 'malar',
    label: 'Malar',
    image: regionImage('Malar', malarSrc),
    guides: [
      { x: 31.25, y: 45, label: 'Arco zigomático' },
      { x: 44, y: 52.1, label: 'Eminência malar' },
      { x: 58.75, y: 57.1, label: 'Malar medial' },
      { x: 45, y: 73.6, label: 'Submalar' },
    ],
  },
  {
    id: 'nasolabial',
    label: 'Sulco nasogeniano',
    image: regionImage('Sulco nasogeniano', nasolabialSrc),
    guides: [
      ...pair(34, 30, 'Base da asa (fossa piriforme)'),
      ...pair(30.75, 42.9, 'Sulco nasogeniano'),
      ...pair(29.5, 57.5, 'Sulco nasogeniano inferior'),
      ...pair(29.75, 76.8, 'Linha de marionete'),
    ],
  },
  {
    id: 'lips',
    label: 'Lábios',
    image: regionImage('Lábios', lipsSrc),
    guides: [
      ...pair(43.1, 38, 'Pico do arco do cupido'),
      { x: 50, y: 48.6, label: 'Tubérculo' },
      ...pair(35.3, 47.9, 'Vermelhão superior'),
      { x: 50, y: 62.5, label: 'Vermelhão inferior' },
      ...pair(37.5, 60, 'Vermelhão inferior'),
      ...pair(19, 53.6, 'Comissura'),
      ...pair(44.75, 26.8, 'Coluna do filtro'),
    ],
  },
  {
    id: 'chin',
    label: 'Mento',
    image: regionImage('Mento', chinSrc),
    guides: [
      { x: 50, y: 36.6, label: 'Sulco mentolabial' },
      { x: 50, y: 66.1, label: 'Pogônio' },
      ...pair(41.9, 62.5, 'Mento lateral'),
      { x: 50, y: 83.9, label: 'Mentoniano' },
      ...pair(31, 57.1, 'Sulco pré-papada'),
    ],
  },
  {
    id: 'jawline',
    label: 'Mandíbula',
    image: regionImage('Mandíbula', jawlineSrc),
    guides: [
      ...pair(13.75, 30.4, 'Ramo da mandíbula'),
      ...pair(19, 53.2, 'Ângulo mandibular'),
      ...pair(29, 73.6, 'Corpo da mandíbula'),
      ...pair(37.5, 82.5, 'Sulco pré-papada'),
    ],
  },
];

const FACE_REGION_BY_ID = new Map(FACE_REGIONS.map((r) => [r.id, r]));

export function faceRegionMap(id?: ApplicationMapView | ApplicationMapRegion | null): FaceRegionMap | undefined {
  return id ? FACE_REGION_BY_ID.get(id as ApplicationMapFaceRegion) : undefined;
}

export const MAP_VIEWS: Record<IllustratedView, MapViewDef> = {
  left: { label: 'Perfil esquerdo', src: faceLeftSrc, width: 600, height: 620 },
  front: { label: 'Frente', src: faceFrontSrc, width: 440, height: 680 },
  right: { label: 'Perfil direito', src: faceRightSrc, width: 600, height: 620 },
  body: { label: 'Corporal', src: bodySrc, width: 929, height: 768 },
  ...(Object.fromEntries(FACE_REGIONS.map((r) => [r.id, r.image])) as Record<ApplicationMapFaceRegion, MapViewDef>),
};

export const FACE_VIEWS: IllustratedView[] = ['left', 'front', 'right'];

/** Recorte da imagem, em % da largura/altura. */
export interface MapCrop {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const FULL_CROP: MapCrop = { x: 0, y: 0, w: 100, h: 100 };

/** Área do corpo: zoom (recorte) na ilustração corporal. */
export interface MapRegionDef {
  id: ApplicationMapRegion;
  label: string;
  crops: Partial<Record<IllustratedView, MapCrop>>;
}

/** Áreas de tratamento corporal (criolipólise) na ilustração de frente e perfil. */
export const BODY_REGIONS: MapRegionDef[] = [
  {
    id: 'submental',
    label: 'Papada',
    crops: { body: { x: 18, y: 8, w: 12, h: 12 } },
  },
  {
    id: 'arms',
    label: 'Braços',
    crops: { body: { x: 5, y: 22, w: 36, h: 42 } },
  },
  {
    id: 'abdomen',
    label: 'Abdômen',
    crops: { body: { x: 13, y: 30, w: 22, h: 24 } },
  },
  {
    id: 'flanks',
    label: 'Flancos',
    crops: { body: { x: 11, y: 28, w: 26, h: 30 } },
  },
  {
    id: 'back',
    label: 'Costas',
    crops: { body: { x: 70, y: 22, w: 16, h: 30 } },
  },
  {
    id: 'saddlebags',
    label: 'Culote',
    crops: { body: { x: 64, y: 42, w: 24, h: 24 } },
  },
  {
    id: 'thighs',
    label: 'Coxas',
    crops: { body: { x: 12, y: 48, w: 24, h: 30 } },
  },
];

const BODY_REGION_BY_ID = new Map(BODY_REGIONS.map((r) => [r.id, r]));

export function bodyRegionDef(id?: ApplicationMapRegion | null): MapRegionDef | undefined {
  return id ? BODY_REGION_BY_ID.get(id) : undefined;
}

const REGION_LABELS = new Map<ApplicationMapRegion, string>([
  ...FACE_REGIONS.map((r) => [r.id, r.label] as const),
  ...BODY_REGIONS.map((r) => [r.id, r.label] as const),
]);

export function regionLabel(id: ApplicationMapRegion): string {
  return REGION_LABELS.get(id) ?? id;
}

export function pointView(point: ApplicationMapPoint): ApplicationMapView {
  return point.view ?? 'front';
}

/** Cores do desenho livre. */
export const STROKE_COLORS = ['#e53935', '#1e88e5', '#2e7d32', '#212121'] as const;

/** Espessuras do desenho, em % da largura visível no momento do traço. */
export const STROKE_WIDTHS = [
  { label: 'Fino', value: 0.5 },
  { label: 'Médio', value: 1 },
  { label: 'Grosso', value: 2 },
] as const;

/** Rascunho do mapa no formulário do atendimento. */
export interface ApplicationMapDraft {
  points: ApplicationMapPoint[];
  strokes: ApplicationMapStroke[];
  photoId?: string;
}

export const EMPTY_MAP_DRAFT: ApplicationMapDraft = { points: [], strokes: [] };

export function toMapDraft(map?: ApplicationMap | null): ApplicationMapDraft {
  if (!map) return EMPTY_MAP_DRAFT;
  return {
    points: map.points ?? [],
    strokes: map.strokes ?? [],
    ...(map.photoId ? { photoId: map.photoId } : {}),
  };
}

/** Mapa no formato da API; sem pontos nem traços a API apaga o mapa. */
export function toApplicationMapPayload(draft: ApplicationMapDraft): ApplicationMap {
  const hasPhotoContent = draft.points.some((p) => p.view === 'photo') || draft.strokes.some((s) => s.view === 'photo');
  return {
    template: 'face',
    points: draft.points.map((p) => {
      const note = p.note?.trim();
      return {
        x: p.x,
        y: p.y,
        ...(note ? { note } : {}),
        ...(p.product ? { product: p.product } : {}),
        ...(p.qty !== undefined ? { qty: p.qty } : {}),
        ...(p.view ? { view: p.view } : {}),
        ...(p.region ? { region: p.region } : {}),
      };
    }),
    ...(draft.strokes.length > 0 ? { strokes: draft.strokes } : {}),
    // A foto só vale para o mapa quando há marcação nela.
    ...(draft.photoId && hasPhotoContent ? { photoId: draft.photoId } : {}),
  };
}

/** `d` do SVG de um traço, em pixels da imagem. */
export function strokePath(points: number[], width: number, height: number): string {
  const parts: string[] = [];
  for (let i = 0; i + 1 < points.length; i += 2) {
    const x = ((points[i] * width) / 100).toFixed(1);
    const y = ((points[i + 1] * height) / 100).toFixed(1);
    parts.push(`${i === 0 ? 'M' : 'L'}${x} ${y}`);
  }
  // Um toque só vira um ponto visível.
  if (points.length === 2) parts.push(`l0.01 0`);
  return parts.join(' ');
}

export function parseQty(text: string): number | undefined {
  const value = Number.parseFloat(text.replace(',', '.'));
  return Number.isFinite(value) && value >= 0 ? value : undefined;
}

export function formatQty(value: number): string {
  return value.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
}

export function formatProductTotal(product: MapProductDef, points: ApplicationMapPoint[]): string {
  const total = points.reduce((sum, p) => sum + (p.product === product.id ? (p.qty ?? 0) : 0), 0);
  const label =
    product.unit === 'ml'
      ? total.toLocaleString('pt-BR', {
          minimumFractionDigits: 1,
          maximumFractionDigits: 2,
        })
      : total.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
  return `${label} ${product.unit}`;
}

const NAME_HINTS: [RegExp, ApplicationMapProduct][] = [
  [/toxina|botox|botul/, 'toxin'],
  [/preench/, 'filler'],
  [/bioestim/, 'biostimulator'],
  [/bioremod/, 'bioremodeler'],
  [/skin ?booster/, 'skinbooster'],
  [/criolip/, 'cryolipolysis'],
];

/** Produtos do atendimento, deduzidos dos nomes dos procedimentos; vazio quando nenhum nome é reconhecido. */
export function guessProducts(procedureNames: string[]): ApplicationMapProduct[] {
  const found = new Set<ApplicationMapProduct>();
  for (const name of procedureNames) {
    const normalized = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    for (const [pattern, product] of NAME_HINTS) if (pattern.test(normalized)) found.add(product);
  }
  return MAP_PRODUCTS.map((p) => p.id).filter((id) => found.has(id));
}
