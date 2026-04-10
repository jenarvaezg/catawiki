import { describe, expect, it } from 'vitest';
import { getCanonicalLotUrl, getLotIdFromUrl } from './lot-url';

describe('getCanonicalLotUrl', () => {
  it('keeps detail lot urls unchanged', () => {
    expect(
      getCanonicalLotUrl('https://www.catawiki.com/es/l/102617066-china-10-yuan-2026-panda'),
    ).toBe('https://www.catawiki.com/es/l/102617066-china-10-yuan-2026-panda');
  });

  it('converts feed view_lot urls into direct lot detail urls', () => {
    expect(
      getCanonicalLotUrl('https://www.catawiki.com/es/x/726162-coleccion?view_lot=102204088'),
    ).toBe('https://www.catawiki.com/es/l/102204088');
  });

  it('extracts the lot id from slugged detail urls', () => {
    expect(
      getLotIdFromUrl('https://www.catawiki.com/es/l/102617066-china-10-yuan-2026-panda'),
    ).toBe('102617066');
  });

  it('extracts the lot id from feed view_lot urls', () => {
    expect(
      getLotIdFromUrl('https://www.catawiki.com/es/x/726162-coleccion?view_lot=102204088'),
    ).toBe('102204088');
  });
});
