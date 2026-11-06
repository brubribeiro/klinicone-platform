import { Prisma } from '@prisma/client';

import { toApplicationMapData } from './appointment.helpers';

describe('toApplicationMapData', () => {
  it('leaves the map untouched when not sent', () => {
    expect(toApplicationMapData(undefined)).toBeUndefined();
  });

  it('clears the map when there are no points', () => {
    expect(toApplicationMapData({ template: 'face', points: [] })).toBe(Prisma.DbNull);
  });

  it('rounds coordinates to 2 decimals and drops blank notes', () => {
    expect(
      toApplicationMapData({
        template: 'face',
        points: [
          { x: 33.3333, y: 40.0612, note: '  Toxina 4U ' },
          { x: 66.6, y: 40, note: '   ' },
        ],
      }),
    ).toEqual({
      template: 'face',
      points: [
        { x: 33.33, y: 40.06, note: 'Toxina 4U' },
        { x: 66.6, y: 40 },
      ],
    });
  });

  it('keeps product, quantity and view of each point', () => {
    expect(
      toApplicationMapData({
        template: 'face',
        points: [
          { x: 50, y: 30, product: 'toxin', qty: 4, view: 'front' },
          { x: 20, y: 60, product: 'filler', qty: 0.333, view: 'body' },
          { x: 70, y: 45, product: 'skinbooster', view: 'left' },
        ],
      }),
    ).toEqual({
      template: 'face',
      points: [
        { x: 50, y: 30, product: 'toxin', qty: 4, view: 'front' },
        { x: 20, y: 60, product: 'filler', qty: 0.33, view: 'body' },
        { x: 70, y: 45, product: 'skinbooster', view: 'left' },
      ],
    });
  });

  it('keeps strokes, regions and the photo of the 3D model', () => {
    expect(
      toApplicationMapData({
        template: 'face',
        photoId: '7a1c3c43-6f0b-4d1c-9a43-1b2f3c4d5e6f',
        points: [{ x: 40, y: 70, product: 'filler', qty: 1, view: 'photo', region: 'lips' }],
        strokes: [
          { view: 'front', color: '#E53935', width: 0.6, points: [10.04, 20.06, 30, 40, 50] },
          { view: 'body', color: '#000000', width: 1, points: [5] },
        ],
      }),
    ).toEqual({
      template: 'face',
      photoId: '7a1c3c43-6f0b-4d1c-9a43-1b2f3c4d5e6f',
      points: [{ x: 40, y: 70, product: 'filler', qty: 1, view: 'photo', region: 'lips' }],
      strokes: [{ view: 'front', color: '#e53935', width: 0.6, points: [10, 20.1, 30, 40] }],
    });
  });

  it('keeps points and strokes of the illustrated region maps', () => {
    expect(
      toApplicationMapData({
        template: 'face',
        points: [{ x: 43.1, y: 38, product: 'filler', qty: 0.1, view: 'lips', region: 'lips' }],
        strokes: [{ view: 'nose', color: '#1e88e5', width: 0.5, points: [40, 50, 42, 52] }],
      }),
    ).toEqual({
      template: 'face',
      points: [{ x: 43.1, y: 38, product: 'filler', qty: 0.1, view: 'lips', region: 'lips' }],
      strokes: [{ view: 'nose', color: '#1e88e5', width: 0.5, points: [40, 50, 42, 52] }],
    });
  });

  it('keeps a map that only has drawings', () => {
    expect(
      toApplicationMapData({
        template: 'face',
        points: [],
        strokes: [{ view: 'body', color: '#1e88e5', width: 1, points: [1, 2, 3, 4] }],
      }),
    ).toEqual({
      template: 'face',
      points: [],
      strokes: [{ view: 'body', color: '#1e88e5', width: 1, points: [1, 2, 3, 4] }],
    });
  });
});
