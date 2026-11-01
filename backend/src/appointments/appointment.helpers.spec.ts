import { Prisma } from '@prisma/client';

import { toApplicationMapData } from './appointment.helpers';

describe('toApplicationMapData', () => {
  it('leaves the map untouched when not sent', () => {
    expect(toApplicationMapData(undefined)).toBeUndefined();
  });

  it('clears the map when there are no points', () => {
    expect(toApplicationMapData({ template: 'face', points: [] })).toBe(Prisma.DbNull);
  });

  it('rounds coordinates and drops blank notes', () => {
    expect(
      toApplicationMapData({
        template: 'face',
        points: [
          { x: 33.333, y: 40.06, note: '  Toxina 4U ' },
          { x: 66.6, y: 40, note: '   ' },
        ],
      }),
    ).toEqual({
      template: 'face',
      points: [
        { x: 33.3, y: 40.1, note: 'Toxina 4U' },
        { x: 66.6, y: 40 },
      ],
    });
  });
});
