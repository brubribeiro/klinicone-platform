import { describe, expect, it } from 'vitest';

import {
  FACE_REGIONS,
  MAP_VIEWS,
  faceRegionMap,
  regionLabel,
  toApplicationMapPayload,
  toMapDraft,
} from './applicationMapModel';

describe('mapas por região do rosto', () => {
  it('cada região tem ilustração própria e pontos sugeridos dentro da imagem', () => {
    for (const region of FACE_REGIONS) {
      expect(MAP_VIEWS[region.id]).toBe(region.image);
      expect(region.guides.length).toBeGreaterThan(0);
      for (const g of region.guides) {
        expect(g.x).toBeGreaterThanOrEqual(0);
        expect(g.x).toBeLessThanOrEqual(100);
        expect(g.y).toBeGreaterThanOrEqual(0);
        expect(g.y).toBeLessThanOrEqual(100);
      }
    }
  });

  it('só as regiões do rosto abrem mapa próprio', () => {
    expect(faceRegionMap('lips')?.label).toBe('Lábios');
    expect(faceRegionMap('front')).toBeUndefined();
    expect(faceRegionMap('abdomen')).toBeUndefined();
    expect(regionLabel('nasolabial')).toBe('Sulco nasogeniano');
  });

  it('mantém pontos antigos (zoom na vista frontal) e novos (mapa da região)', () => {
    const payload = toApplicationMapPayload({
      points: [
        { x: 50, y: 70, product: 'filler', view: 'front', region: 'lips' },
        { x: 43.1, y: 38, product: 'filler', qty: 0.1, view: 'lips', region: 'lips' },
      ],
      strokes: [{ view: 'lips', color: '#e53935', width: 0.5, points: [10, 10, 20, 20] }],
    });
    expect(payload.points.map((p) => p.view)).toEqual(['front', 'lips']);
    expect(payload.strokes).toHaveLength(1);
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
