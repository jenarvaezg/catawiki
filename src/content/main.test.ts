import { describe, expect, it } from 'vitest';
import { detectPageType } from './page-type';

describe('detectPageType', () => {
  it('detects lot detail pages', () => {
    expect(detectPageType('https://www.catawiki.com/es/l/102743830-china-10-yuan')).toBe('lot-detail');
  });

  it('detects category, feed, and short search listings', () => {
    expect(detectPageType('https://www.catawiki.com/es/c/718-monedas-del-mundo')).toBe('listing');
    expect(detectPageType('https://www.catawiki.com/es/feed?tab_name=feeds_recommendations')).toBe('listing');
    expect(detectPageType('https://www.catawiki.com/es/s?q=silver')).toBe('listing');
  });

  it('returns unknown for unrelated pages', () => {
    expect(detectPageType('https://www.catawiki.com/es/help')).toBe('unknown');
  });
});
