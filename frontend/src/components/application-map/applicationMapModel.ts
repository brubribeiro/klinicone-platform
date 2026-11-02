import faceFrontSrc from '../../assets/application-map/face-frente.webp';
import faceLeftSrc from '../../assets/application-map/face-perfil-e.webp';
import faceRightSrc from '../../assets/application-map/face-perfil-d.webp';
import bodySrc from '../../assets/application-map/corpo.webp';
import type { ApplicationMapPoint, ApplicationMapProduct, ApplicationMapView } from '../../types';

export interface MapProductDef {
  id: ApplicationMapProduct;
  label: string;
  color: string;
  unit: 'U' | 'ml';
}

export const MAP_PRODUCTS: MapProductDef[] = [
  { id: 'toxin', label: 'Toxina Botulínica', color: '#15998B', unit: 'U' },
  { id: 'filler', label: 'Preenchimento', color: '#9B7BD4', unit: 'ml' },
  { id: 'biostimulator', label: 'Bioestimulador', color: '#5BA8DE', unit: 'ml' },
  { id: 'bioremodeler', label: 'Bioremodelador', color: '#E0915B', unit: 'ml' },
  { id: 'skinbooster', label: 'Skinbooster', color: '#D46B8A', unit: 'ml' },
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

export const MAP_VIEWS: Record<ApplicationMapView, MapViewDef> = {
  left: { label: 'Perfil esquerdo', src: faceLeftSrc, width: 600, height: 620 },
  front: { label: 'Frente', src: faceFrontSrc, width: 440, height: 680 },
  right: { label: 'Perfil direito', src: faceRightSrc, width: 600, height: 620 },
  body: { label: 'Corporal', src: bodySrc, width: 929, height: 768 },
};

export const FACE_VIEWS: ApplicationMapView[] = ['left', 'front', 'right'];

export function pointView(point: ApplicationMapPoint): ApplicationMapView {
  return point.view ?? 'front';
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
    product.unit === 'U'
      ? total.toLocaleString('pt-BR', { maximumFractionDigits: 1 })
      : total.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 });
  return `${label} ${product.unit}`;
}

const NAME_HINTS: [RegExp, ApplicationMapProduct][] = [
  [/toxina|botox|botul/, 'toxin'],
  [/preench/, 'filler'],
  [/bioestim/, 'biostimulator'],
  [/bioremod/, 'bioremodeler'],
  [/skin ?booster/, 'skinbooster'],
];

/** Produto já selecionado ao abrir o mapa, deduzido do nome do primeiro procedimento reconhecido. */
export function guessProduct(procedureNames: string[]): ApplicationMapProduct {
  for (const name of procedureNames) {
    const normalized = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const hit = NAME_HINTS.find(([pattern]) => pattern.test(normalized));
    if (hit) return hit[1];
  }
  return 'toxin';
}
