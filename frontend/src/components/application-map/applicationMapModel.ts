import faceFrontSrc from '../../assets/application-map/face-frente.webp';
import faceLeftSrc from '../../assets/application-map/face-perfil-e.webp';
import faceRightSrc from '../../assets/application-map/face-perfil-d.webp';
import bodySrc from '../../assets/application-map/corpo.webp';
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

/** Vistas do modelo 3D genérico (cabeça e corpo). */
export type Model3DView = 'head3d' | 'body3d';

/** Vistas ilustradas em 2D (`photo` é legado e abre como `front`; as regiões do rosto também, ver `toMapDraft`). */
export type IllustratedView = Exclude<ApplicationMapView, 'photo' | Model3DView | ApplicationMapFaceRegion>;

/** Ilustrações do rosto inteiro. */
export type FaceView = 'left' | 'front' | 'right';

export function is3DView(view: ApplicationMapView): view is Model3DView {
  return view === 'head3d' || view === 'body3d';
}

export const MAP_VIEWS: Record<IllustratedView, MapViewDef> = {
  left: { label: 'Perfil esquerdo', src: faceLeftSrc, width: 600, height: 620 },
  front: { label: 'Frente', src: faceFrontSrc, width: 440, height: 680 },
  right: { label: 'Perfil direito', src: faceRightSrc, width: 600, height: 620 },
  body: { label: 'Corporal', src: bodySrc, width: 929, height: 768 },
};

export const FACE_VIEWS: FaceView[] = ['left', 'front', 'right'];

/** Recorte da imagem, em % da largura/altura. */
export interface MapCrop {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const FULL_CROP: MapCrop = { x: 0, y: 0, w: 100, h: 100 };

/** Ponto de aplicação sugerido num mapa de região; x/y em % da ilustração inteira. */
export interface MapGuide {
  x: number;
  y: number;
  label: string;
}

/**
 * Região do rosto: zoom (recorte) numa ilustração do rosto inteiro, com pontos sugeridos.
 * Pontos e traços marcados nela ficam na vista da ilustração (`front`, `right`) com `region`,
 * em % da ilustração inteira, como nas áreas do corpo.
 */
export interface FaceRegionMap {
  id: ApplicationMapFaceRegion;
  label: string;
  view: FaceView;
  crop: MapCrop;
  guides: MapGuide[];
  /**
   * Onde o antigo desenho próprio da região (800×560, vista = id da região) fica na ilustração,
   * em %; `w` negativo = desenho espelhado. Converte as marcações salvas nele (`toMapDraft`).
   */
  legacyFrame: MapCrop;
}

/** Linha média do rosto na ilustração de frente, em % da largura. */
const FRONT_MIDLINE = 52;
/** Ponto sugerido nos dois lados do rosto (ilustração de frente). */
const pair = (x: number, y: number, label: string): MapGuide[] => [
  { x, y, label },
  { x: 2 * FRONT_MIDLINE - x, y, label },
];

export const FACE_REGIONS: FaceRegionMap[] = [
  {
    id: 'forehead',
    label: 'Testa e glabela',
    view: 'front',
    crop: { x: 14, y: 12, w: 76, h: 32 },
    guides: [
      ...pair(34, 26.5, 'Frontal'),
      ...pair(43, 25.5, 'Frontal'),
      { x: 52, y: 25, label: 'Frontal' },
      { x: 52, y: 38.5, label: 'Prócero' },
      ...pair(45, 36, 'Corrugador'),
      ...pair(22.5, 36.3, 'Cauda da sobrancelha'),
    ],
    legacyFrame: { x: -0.9, y: 14.1, w: 105.9, h: 35.9 },
  },
  {
    id: 'temples',
    label: 'Têmporas',
    view: 'right',
    crop: { x: 42, y: 26, w: 44, h: 32 },
    guides: [
      { x: 63.5, y: 35.5, label: 'Fossa temporal superior' },
      { x: 60.5, y: 40.5, label: 'Fossa temporal' },
      { x: 62.5, y: 45.5, label: 'Fossa temporal inferior' },
    ],
    legacyFrame: { x: 82.1, y: 16.9, w: -43.7, h: 52.8 },
  },
  {
    id: 'periorbital',
    label: 'Olheiras',
    view: 'front',
    crop: { x: 14, y: 28, w: 76, h: 30 },
    guides: [
      ...pair(63.9, 45.3, 'Sulco lacrimal medial'),
      ...pair(67.2, 46.6, 'Sulco lacrimal'),
      ...pair(71.2, 47.2, 'Sulco lacrimal lateral'),
      ...pair(76.5, 46.8, 'Sulco palpebromalar'),
      ...pair(85.5, 38.6, 'Pés de galinha'),
      ...pair(86.3, 40.8, 'Pés de galinha'),
      ...pair(85.5, 43, 'Pés de galinha'),
    ],
    legacyFrame: { x: 47.3, y: 30, w: 49.1, h: 27.6 },
  },
  {
    id: 'nose',
    label: 'Nariz',
    view: 'right',
    crop: { x: 64, y: 40, w: 34, h: 32 },
    guides: [
      { x: 81.8, y: 48.5, label: 'Radix' },
      { x: 84, y: 55, label: 'Dorso' },
      { x: 86.8, y: 59, label: 'Supra-ponta' },
      { x: 88.2, y: 62, label: 'Ponta' },
      { x: 83.8, y: 66.5, label: 'Espinha nasal (base da columela)' },
    ],
    legacyFrame: { x: 97, y: 41.4, w: -25.4, h: 31.3 },
  },
  {
    id: 'malar',
    label: 'Malar',
    view: 'front',
    crop: { x: 8, y: 34, w: 88, h: 36 },
    guides: [
      ...pair(19.5, 47.5, 'Arco zigomático'),
      ...pair(27, 50.5, 'Eminência malar'),
      ...pair(36, 50.5, 'Malar medial'),
      ...pair(28.5, 58.5, 'Submalar'),
    ],
    legacyFrame: { x: 0.9, y: 30, w: 60.1, h: 38.1 },
  },
  {
    id: 'nasolabial',
    label: 'Sulco nasogeniano',
    view: 'front',
    crop: { x: 26, y: 52, w: 52, h: 24 },
    guides: [
      ...pair(44.8, 58, 'Base da asa (fossa piriforme)'),
      ...pair(42.3, 61.3, 'Sulco nasogeniano'),
      ...pair(40.2, 64.5, 'Sulco nasogeniano inferior'),
      ...pair(38.6, 71, 'Linha de marionete'),
    ],
    legacyFrame: { x: 24, y: 49.5, w: 56, h: 27.5 },
  },
  {
    id: 'lips',
    label: 'Lábios',
    view: 'front',
    crop: { x: 32, y: 58, w: 40, h: 18 },
    guides: [
      ...pair(49.2, 64.3, 'Pico do arco do cupido'),
      { x: 52, y: 66.3, label: 'Tubérculo' },
      ...pair(43.5, 65.6, 'Vermelhão superior'),
      { x: 52, y: 69.6, label: 'Vermelhão inferior' },
      ...pair(45, 69.2, 'Vermelhão inferior'),
      ...pair(38.3, 67.1, 'Comissura'),
      ...pair(50.6, 61.8, 'Coluna do filtro'),
    ],
    legacyFrame: { x: 28.4, y: 55.9, w: 47.1, h: 21.5 },
  },
  {
    id: 'chin',
    label: 'Mento',
    view: 'front',
    crop: { x: 30, y: 66, w: 44, h: 18 },
    guides: [
      { x: 52, y: 73.2, label: 'Sulco mentolabial' },
      { x: 52, y: 78, label: 'Pogônio' },
      ...pair(46.5, 77.6, 'Mento lateral'),
      { x: 52, y: 80.8, label: 'Mentoniano' },
      ...pair(40.5, 77.5, 'Sulco pré-papada'),
    ],
    legacyFrame: { x: 21.2, y: 68, w: 61.7, h: 15.5 },
  },
  {
    id: 'jawline',
    label: 'Mandíbula',
    view: 'front',
    crop: { x: 8, y: 50, w: 88, h: 36 },
    guides: [
      ...pair(21, 60, 'Ramo da mandíbula'),
      ...pair(23.5, 66.5, 'Ângulo mandibular'),
      ...pair(31.5, 72.5, 'Corpo da mandíbula'),
      ...pair(42, 79, 'Sulco pré-papada'),
    ],
    legacyFrame: { x: 7.4, y: 48.8, w: 89.2, h: 34.5 },
  },
];

const FACE_REGION_BY_ID = new Map(FACE_REGIONS.map((r) => [r.id, r]));

export function faceRegionMap(id?: ApplicationMapView | ApplicationMapRegion | null): FaceRegionMap | undefined {
  return id ? FACE_REGION_BY_ID.get(id as ApplicationMapFaceRegion) : undefined;
}

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
  return !point.view || point.view === 'photo' ? 'front' : point.view;
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
}

export const EMPTY_MAP_DRAFT: ApplicationMapDraft = { points: [], strokes: [] };

/**
 * Marcações antigas feitas sobre a foto da paciente (vista `photo`, já sem foto nem malha
 * gerada dela) passam para a ilustração de frente, nas mesmas coordenadas.
 */
const fromLegacyView = <T extends { view?: ApplicationMapView }>(mark: T): T =>
  mark.view === 'photo' ? { ...mark, view: 'front' } : mark;

const round2 = (n: number) => Math.round(n * 100) / 100;
const clamp100 = (n: number) => Math.min(100, Math.max(0, n));

/** Ponto em % do antigo desenho da região → % da ilustração do rosto. */
const fromLegacyFrame = (frame: MapCrop, x: number, y: number) => ({
  x: round2(clamp100(frame.x + (x * frame.w) / 100)),
  y: round2(clamp100(frame.y + (y * frame.h) / 100)),
});

/**
 * Pontos marcados no antigo desenho próprio de cada região (vista = id da região) passam para
 * a ilustração do rosto que a região agora amplia, no mesmo lugar da anatomia.
 */
function fromLegacyRegionPoint(point: ApplicationMapPoint): ApplicationMapPoint {
  const region = faceRegionMap(point.view);
  if (!region) return point;
  return { ...point, ...fromLegacyFrame(region.legacyFrame, point.x, point.y), view: region.view, region: region.id };
}

function fromLegacyRegionStroke(stroke: ApplicationMapStroke): ApplicationMapStroke {
  const region = faceRegionMap(stroke.view);
  if (!region) return stroke;
  const frame = region.legacyFrame;
  const points: number[] = [];
  for (let i = 0; i + 1 < stroke.points.length; i += 2) {
    const p = fromLegacyFrame(frame, stroke.points[i], stroke.points[i + 1]);
    points.push(p.x, p.y);
  }
  return { ...stroke, view: region.view, width: round2((stroke.width * Math.abs(frame.w)) / 100), points };
}

export function toMapDraft(map?: ApplicationMap | null): ApplicationMapDraft {
  if (!map) return EMPTY_MAP_DRAFT;
  return {
    points: (map.points ?? []).map((p) => fromLegacyRegionPoint(fromLegacyView(p))),
    strokes: (map.strokes ?? []).map((s) => fromLegacyRegionStroke(fromLegacyView(s))),
  };
}

/** Mapa no formato da API; sem pontos nem traços a API apaga o mapa. */
export function toApplicationMapPayload(draft: ApplicationMapDraft): ApplicationMap {
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
