import { describe, expect, it } from 'vitest';

import type { ApplicationMapFaceRegion } from '../../types';
import {
  FACE_REGIONS,
  FACE_VIEWS,
  MAP_VIEWS,
  type MapCrop,
  type MapGuide,
  faceRegionMap,
  regionLabel,
  toApplicationMapPayload,
  toMapDraft,
} from './applicationMapModel';

/** Pontos sugeridos do antigo desenho próprio de cada região (800×560), para conferir a conversão. */
const half = (x: number, y: number, label: string) => [
  { x, y, label },
  { x: 100 - x, y, label },
];
const LEGACY_GUIDES: Record<ApplicationMapFaceRegion, { x: number; y: number; label: string }[]> = {
  forehead: [
    ...half(31.25, 33.9, 'Frontal'),
    ...half(40.6, 32.1, 'Frontal'),
    { x: 50, y: 31.4, label: 'Frontal' },
    { x: 50, y: 66.4, label: 'Prócero' },
    ...half(43.25, 61.8, 'Corrugador'),
    ...half(23.75, 62.5, 'Cauda da sobrancelha'),
  ],
  temples: [
    { x: 42.5, y: 35.7, label: 'Fossa temporal superior' },
    { x: 49.4, y: 43.75, label: 'Fossa temporal' },
    { x: 45, y: 54.5, label: 'Fossa temporal inferior' },
  ],
  periorbital: [
    { x: 34.4, y: 55.7, label: 'Sulco lacrimal medial' },
    { x: 40.6, y: 60.4, label: 'Sulco lacrimal' },
    { x: 48.1, y: 62.5, label: 'Sulco lacrimal lateral' },
    { x: 58.75, y: 61.1, label: 'Sulco palpebromalar' },
    { x: 77.75, y: 31.8, label: 'Pés de galinha' },
    { x: 80, y: 38.9, label: 'Pés de galinha' },
    { x: 77.75, y: 46.8, label: 'Pés de galinha' },
  ],
  nose: [
    { x: 61.5, y: 21.8, label: 'Radix' },
    { x: 50.5, y: 42.9, label: 'Dorso' },
    { x: 40.25, y: 59.8, label: 'Supra-ponta' },
    { x: 36, y: 68.6, label: 'Ponta' },
    { x: 50.25, y: 75.7, label: 'Espinha nasal (base da columela)' },
  ],
  malar: [
    { x: 31.25, y: 45, label: 'Arco zigomático' },
    { x: 44, y: 52.1, label: 'Eminência malar' },
    { x: 58.75, y: 57.1, label: 'Malar medial' },
    { x: 45, y: 73.6, label: 'Submalar' },
  ],
  nasolabial: [
    ...half(34, 30, 'Base da asa (fossa piriforme)'),
    ...half(30.75, 42.9, 'Sulco nasogeniano'),
    ...half(29.5, 57.5, 'Sulco nasogeniano inferior'),
    ...half(29.75, 76.8, 'Linha de marionete'),
  ],
  lips: [
    ...half(43.1, 38, 'Pico do arco do cupido'),
    { x: 50, y: 48.6, label: 'Tubérculo' },
    ...half(35.3, 47.9, 'Vermelhão superior'),
    { x: 50, y: 62.5, label: 'Vermelhão inferior' },
    ...half(37.5, 60, 'Vermelhão inferior'),
    ...half(19, 53.6, 'Comissura'),
    ...half(44.75, 26.8, 'Coluna do filtro'),
  ],
  chin: [
    { x: 50, y: 36.6, label: 'Sulco mentolabial' },
    { x: 50, y: 66.1, label: 'Pogônio' },
    ...half(41.9, 62.5, 'Mento lateral'),
    { x: 50, y: 83.9, label: 'Mentoniano' },
    ...half(31, 57.1, 'Sulco pré-papada'),
  ],
  jawline: [
    ...half(13.75, 30.4, 'Ramo da mandíbula'),
    ...half(19, 53.2, 'Ângulo mandibular'),
    ...half(29, 73.6, 'Corpo da mandíbula'),
    ...half(37.5, 82.5, 'Sulco pré-papada'),
  ],
};

const inside = (crop: MapCrop, x: number, y: number) =>
  x >= crop.x && x <= crop.x + crop.w && y >= crop.y && y <= crop.y + crop.h;

describe('mapas por região do rosto', () => {
  it('cada região é um recorte da ilustração do rosto, com os pontos sugeridos dentro dele', () => {
    for (const region of FACE_REGIONS) {
      expect(FACE_VIEWS).toContain(region.view);
      const { crop } = region;
      expect(crop.x).toBeGreaterThanOrEqual(0);
      expect(crop.y).toBeGreaterThanOrEqual(0);
      expect(crop.x + crop.w).toBeLessThanOrEqual(100);
      expect(crop.y + crop.h).toBeLessThanOrEqual(100);
      // Quadro nem muito estreito nem muito largo para a área do mapa.
      const image = MAP_VIEWS[region.view];
      const aspect = (crop.w * image.width) / (crop.h * image.height);
      expect(aspect).toBeGreaterThan(0.9);
      expect(aspect).toBeLessThan(1.8);
      expect(region.guides.length).toBeGreaterThan(0);
      for (const g of region.guides) expect(inside(crop, g.x, g.y), `${region.id}: ${g.label}`).toBe(true);
    }
  });

  it('só as regiões do rosto abrem mapa próprio', () => {
    expect(faceRegionMap('lips')?.label).toBe('Lábios');
    expect(faceRegionMap('front')).toBeUndefined();
    expect(faceRegionMap('abdomen')).toBeUndefined();
    expect(regionLabel('nasolabial')).toBe('Sulco nasogeniano');
  });

  it('pontos do antigo desenho da região caem no mesmo lugar da anatomia na ilustração', () => {
    for (const region of FACE_REGIONS) {
      const legacy = LEGACY_GUIDES[region.id];
      const draft = toMapDraft({
        template: 'face',
        points: legacy.map((g) => ({ x: g.x, y: g.y, product: 'filler', qty: 0.1, view: region.id })),
      });
      const image = MAP_VIEWS[region.view];
      draft.points.forEach((p, i) => {
        expect(p).toMatchObject({ view: region.view, region: region.id, product: 'filler', qty: 0.1 });
        // Mais perto do ponto sugerido de mesmo nome que de qualquer outro, e a menos de 4% da largura.
        const dist = (g: MapGuide) => Math.hypot(((p.x - g.x) * image.width) / 100, ((p.y - g.y) * image.height) / 100);
        const nearest = [...region.guides].sort((a, b) => dist(a) - dist(b))[0];
        expect(nearest.label, `${region.id}: ${legacy[i].label}`).toBe(legacy[i].label);
        expect(dist(nearest)).toBeLessThan(image.width * 0.04);
      });
    }
  });

  it('traços do antigo desenho da região passam para a ilustração, com a espessura na nova escala', () => {
    const draft = toMapDraft({
      template: 'face',
      points: [],
      strokes: [{ view: 'nose', color: '#e53935', width: 1, points: [0, 0, 100, 100] }],
    });
    const frame = faceRegionMap('nose')!.legacyFrame;
    expect(draft.strokes[0]).toMatchObject({ view: 'right', color: '#e53935' });
    expect(draft.strokes[0].width).toBeCloseTo(Math.abs(frame.w) / 100, 2);
    // Desenho espelhado: a ponta do nariz olha para a direita na ilustração.
    expect(draft.strokes[0].points).toEqual([frame.x, frame.y, frame.x + frame.w, frame.y + frame.h]);
  });

  it('pontos novos da região já ficam na ilustração do rosto e não são convertidos de novo', () => {
    const point = { x: 52, y: 66.3, product: 'filler' as const, view: 'front' as const, region: 'lips' as const };
    const draft = toMapDraft({ template: 'face', points: [point] });
    expect(draft.points[0]).toEqual(point);
    expect(toApplicationMapPayload(draft).points[0]).toEqual(point);
  });

  it('marcações antigas na foto da paciente abrem na ilustração de frente', () => {
    const draft = toMapDraft({
      template: 'face',
      points: [{ x: 40, y: 55, product: 'toxin', view: 'photo' }],
      strokes: [{ view: 'photo', color: '#e53935', width: 0.5, points: [1, 2, 3, 4] }],
    });
    expect(draft.points[0].view).toBe('front');
    expect(draft.strokes[0].view).toBe('front');
    const payload = toApplicationMapPayload(draft);
    expect(payload.points[0].view).toBe('front');
    expect(payload).not.toHaveProperty('photoId');
  });

  it('mantém as marcações do modelo 3D genérico', () => {
    const payload = toApplicationMapPayload({
      points: [{ x: 50, y: 44.5, product: 'filler', view: 'head3d' }],
      strokes: [{ view: 'body3d', color: '#1e88e5', width: 1, points: [10, 20, 11, 21] }],
    });
    expect(payload.points[0].view).toBe('head3d');
    expect(payload.strokes?.[0].view).toBe('body3d');
  });
});
