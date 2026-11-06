import faceFrontSrc from '../../assets/application-map/face-frente.webp';
import faceLeftSrc from '../../assets/application-map/face-perfil-e.webp';
import faceRightSrc from '../../assets/application-map/face-perfil-d.webp';
import bodySrc from '../../assets/application-map/corpo.webp';
import type {
  ApplicationMap,
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

export const MAP_VIEWS: Record<IllustratedView, MapViewDef> = {
  left: { label: 'Perfil esquerdo', src: faceLeftSrc, width: 600, height: 620 },
  front: { label: 'Frente', src: faceFrontSrc, width: 440, height: 680 },
  right: { label: 'Perfil direito', src: faceRightSrc, width: 600, height: 620 },
  body: { label: 'Corporal', src: bodySrc, width: 929, height: 768 },
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

export interface MapRegionDef {
  id: ApplicationMapRegion;
  label: string;
  crops: Partial<Record<IllustratedView, MapCrop>>;
}

/** Recorte no perfil esquerdo espelhado para o direito (as ilustrações são simétricas). */
function profiles(left: MapCrop): Pick<MapRegionDef['crops'], 'left' | 'right'> {
  return { left, right: { ...left, x: 100 - left.x - left.w } };
}

/** Regiões do rosto com zoom (preenchimento, toxina…), por vista. */
export const FACE_REGIONS: MapRegionDef[] = [
  {
    id: 'forehead',
    label: 'Testa e glabela',
    crops: {
      front: { x: 18, y: 12, w: 64, h: 28 },
      ...profiles({ x: 0, y: 12, w: 42, h: 30 }),
    },
  },
  {
    id: 'periorbital',
    label: 'Olhos',
    crops: {
      front: { x: 16, y: 30, w: 68, h: 20 },
      ...profiles({ x: 2, y: 30, w: 44, h: 22 }),
    },
  },
  {
    id: 'nose',
    label: 'Nariz',
    crops: {
      front: { x: 33, y: 33, w: 34, h: 29 },
      ...profiles({ x: 0, y: 40, w: 32, h: 30 }),
    },
  },
  {
    id: 'malar',
    label: 'Malar',
    crops: {
      front: { x: 12, y: 38, w: 76, h: 28 },
      ...profiles({ x: 4, y: 38, w: 52, h: 30 }),
    },
  },
  {
    id: 'lips',
    label: 'Lábios',
    crops: {
      front: { x: 31, y: 58, w: 38, h: 19 },
      ...profiles({ x: 0, y: 60, w: 30, h: 22 }),
    },
  },
  {
    id: 'chin',
    label: 'Mento',
    crops: {
      front: { x: 29, y: 67, w: 42, h: 20 },
      ...profiles({ x: 0, y: 68, w: 38, h: 24 }),
    },
  },
  {
    id: 'jawline',
    label: 'Mandíbula',
    crops: {
      front: { x: 8, y: 50, w: 84, h: 40 },
      ...profiles({ x: 0, y: 56, w: 62, h: 38 }),
    },
  },
];

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

const REGION_BY_ID = new Map([...FACE_REGIONS, ...BODY_REGIONS].map((r) => [r.id, r]));

export function regionDef(id?: ApplicationMapRegion): MapRegionDef | undefined {
  return id ? REGION_BY_ID.get(id) : undefined;
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
