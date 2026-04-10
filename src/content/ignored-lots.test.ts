import { describe, expect, it } from 'vitest';
import { normalizeIgnoredLotIds, normalizeIgnoredLots, shouldHideIgnoredLot } from './ignored-lots';

describe('ignored lots', () => {
  it('normalizes stored lot ids and removes duplicates', () => {
    expect(normalizeIgnoredLotIds([' 102 ', '', '102', 55, '204'])).toEqual(['102', '204']);
  });

  it('normalizes ignored lot metadata and keeps the latest unique entries', () => {
    expect(normalizeIgnoredLots([
      { lotId: '102', lotUrl: 'https://www.catawiki.com/es/l/102-foo', title: 'Foo', ignoredAt: '2026-04-10T10:00:00.000Z' },
      '204',
      { lotId: '102', lotUrl: '', title: '', ignoredAt: '2026-04-10T11:00:00.000Z' },
    ])).toEqual([
      {
        lotId: '102',
        lotUrl: 'https://www.catawiki.com/es/l/102-foo',
        title: 'Foo',
        ignoredAt: '2026-04-10T11:00:00.000Z',
      },
      {
        lotId: '204',
        lotUrl: 'http://localhost:3000/en/l/204',
        title: 'Lot 204',
        ignoredAt: '1970-01-01T00:00:00.000Z',
      },
    ]);
  });

  it('hides only lots that are present in the ignored set', () => {
    const ignoredIds = new Set(['102617066', '102743830']);

    expect(shouldHideIgnoredLot('102617066', ignoredIds)).toBe(true);
    expect(shouldHideIgnoredLot('999999999', ignoredIds)).toBe(false);
    expect(shouldHideIgnoredLot(null, ignoredIds)).toBe(false);
  });
});
