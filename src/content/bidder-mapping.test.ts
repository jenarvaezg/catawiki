import { describe, expect, it } from 'vitest';
import { normalizeBidderId, normalizeBidderMapping } from './bidder-mapping';

describe('bidder mapping', () => {
  it('extracts numeric ids from a variety of inputs', () => {
    expect(normalizeBidderId(' 2943 ')).toBe('2943');
    expect(normalizeBidderId('Pujador 2943')).toBe('2943');
    expect(normalizeBidderId('Bidder 8646 (487)')).toBe('8646');
    expect(normalizeBidderId(2383)).toBe('2383');
    expect(normalizeBidderId('')).toBeNull();
    expect(normalizeBidderId(null)).toBeNull();
    expect(normalizeBidderId('no digits')).toBeNull();
  });

  it('normalizes a mapping dropping invalid entries', () => {
    expect(
      normalizeBidderMapping({
        '2943': 'Cebada',
        ' 2383 ': ' Jorge ',
        '  ': 'ghost',
        '8646': '   ',
        '1185': 42,
      }),
    ).toEqual({
      '2943': 'Cebada',
      '2383': 'Jorge',
    });
  });

  it('returns an empty mapping for non-object input', () => {
    expect(normalizeBidderMapping(null)).toEqual({});
    expect(normalizeBidderMapping('foo')).toEqual({});
    expect(normalizeBidderMapping(undefined)).toEqual({});
  });
});
