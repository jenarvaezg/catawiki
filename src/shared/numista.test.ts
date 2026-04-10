import { describe, expect, it } from 'vitest';
import {
  buildBullionBasis,
  buildDirectBullionBasis,
  buildWeightRange,
  buildMarketCacheFingerprint,
  estimateBullionValue,
  buildLotSearchMetadata,
  buildSearchVariants,
  buildSearchQuery,
  extractFaceValue,
  extractLotQuantity,
  extractPurity,
  pickBestType,
  pickBestDetailedType,
  pickIssueForYear,
  scoreDetailedTypeMatch,
  summarizePrices,
} from './numista';

describe('numista helpers', () => {
  it('builds a clean search query from the Catawiki lot title', () => {
    expect(buildSearchQuery('Canada. 5 Dollars 1999 - Maple Leaf - sin precio de reserva')).toBe(
      'canada 5 dollars 1999 maple leaf',
    );
  });

  it('prefers the best matching type using title, issuer, and year', () => {
    const metadata = buildLotSearchMetadata(
      'https://www.catawiki.com/es/l/1',
      'Canada. 5 Dollars 1999 - Maple Leaf',
      'es',
    );

    const best = pickBestType([
      {
        id: 12,
        title: '5 Dollars - Maple Leaf',
        issuer: { code: 'canada', name: 'Canada' },
        min_year: 1988,
        max_year: 2001,
      },
      {
        id: 99,
        title: '10 Dollars - Olympic commemorative',
        issuer: { code: 'canada', name: 'Canada' },
        min_year: 1973,
        max_year: 1976,
      },
    ], metadata);

    expect(best?.id).toBe(12);
  });

  it('extracts the face value from the lot title', () => {
    expect(extractFaceValue('Canada. 5 Dollars 1999 - Maple Leaf')).toEqual({
      raw: '5 dollars',
      amount: 5,
      normalizedUnit: 'dollar',
    });
  });

  it('extracts lot quantity from common listing patterns', () => {
    expect(extractLotQuantity('Venezuela. 1 Bolivar 1960/1965 - lot of 4 coins')).toBe(4);
    expect(extractLotQuantity('Australia. 1 Dollar 2020 - 3 coins')).toBe(3);
    expect(extractLotQuantity('Canada. 5 Dollars 1999 - Maple Leaf')).toBe(1);
  });

  it('extracts purity from Numista composition text', () => {
    expect(extractPurity('Silver (.835)')).toBe(0.835);
    expect(extractPurity('Silver (0.9999)')).toBe(0.9999);
    expect(extractPurity('Gold 900/1000')).toBe(0.9);
    expect(extractPurity('Ag .999')).toBe(0.999);
  });

  it('penalizes a wrong denomination heavily enough to avoid 2 Dollars matches', () => {
    const metadata = buildLotSearchMetadata(
      'https://www.catawiki.com/es/l/102721592',
      'Canada. 5 Dollars 1999 - Maple Leaf',
      'es',
    );

    const best = pickBestType([
      {
        id: 38183,
        title: '2 Dollars - Elizabeth II (3rd portrait; Logo maple leaf; Silver)',
        issuer: { code: 'canada', name: 'Canada' },
        min_year: 1998,
        max_year: 1999,
      },
      {
        id: 6735,
        title: '5 Dollars - Elizabeth II (Maple Leaf)',
        issuer: { code: 'canada', name: 'Canada' },
        min_year: 1998,
        max_year: 1999,
      },
    ], metadata);

    expect(best?.id).toBe(6735);
  });

  it('uses detailed value and weight data to favor the correct Maple Leaf type', () => {
    const metadata = buildLotSearchMetadata(
      'https://www.catawiki.com/es/l/102721592',
      'Canada. 5 Dollars 1999 - Maple Leaf 1 oz Silver',
      'es',
    );

    const wrong = {
      id: 38183,
      title: '2 Dollars - Elizabeth II (3rd portrait; Logo maple leaf; Silver)',
      issuer: { code: 'canada', name: 'Canada' },
      min_year: 1998,
      max_year: 1999,
      value: { text: '2 Dollars', numeric_value: 2 },
      weight: 15.87,
      composition: { text: 'Silver (.9999)' },
    };

    const correct = {
      id: 6735,
      title: '5 Dollars - Elizabeth II (Maple Leaf)',
      issuer: { code: 'canada', name: 'Canada' },
      min_year: 1998,
      max_year: 1999,
      value: { text: '5 Dollars', numeric_value: 5 },
      weight: 31.1,
      composition: { text: 'Silver (.9999)' },
    };

    expect(scoreDetailedTypeMatch(correct, metadata)).toBeGreaterThan(scoreDetailedTypeMatch(wrong, metadata));
    expect(pickBestDetailedType([wrong, correct], metadata)?.id).toBe(6735);
  });

  it('builds simplified search variants for noisy bullion titles like Panda 10 Yuan', () => {
    const metadata = buildLotSearchMetadata(
      'https://www.catawiki.com/es/l/102743830',
      'China. 10 Yuan 2026 - Panda - 30 g Silver Coin - Ag .999 - BU',
      'es',
    );

    expect(buildSearchVariants(metadata)).toContain('china 10 yuan panda');
    expect(buildSearchVariants(metadata)).toContain('10 yuan panda');
  });

  it('keeps commemorative descriptors in search variants', () => {
    const metadata = buildLotSearchMetadata(
      'https://www.catawiki.com/es/l/102865093',
      'Australia. 1 Dollar 2008 - Discover Australia - Hobart silver coin - 1 oz Silver - Ag .999 - Colorized',
      'es',
    );

    expect(buildSearchVariants(metadata)).toContain('australia 1 dollar discover australia hobart colorized');
    expect(buildSearchVariants(metadata)).toContain('1 dollar discover australia hobart colorized');
    expect(buildSearchVariants(metadata)).toContain('discover australia hobart colorized');
  });

  it('builds the same cache fingerprint for identical coins with different lot urls', () => {
    const first = buildLotSearchMetadata(
      'https://www.catawiki.com/es/l/102743830',
      'China. 10 Yuan 2026 - Panda - 30 g Silver Coin - Ag .999 - BU',
      'es',
    );

    const second = buildLotSearchMetadata(
      'https://www.catawiki.com/es/l/102617066',
      'China. 10 Yuan 2026 - Panda - 30 g Silver Coin - Ag .999 - BU',
      'es',
    );

    expect(buildMarketCacheFingerprint(first)).toBe(buildMarketCacheFingerprint(second));
  });

  it('uses a weight range instead of an exact value for API search filters', () => {
    expect(buildWeightRange(31.1)).toBe('30.5-31.7');
    expect(buildWeightRange(30)).toBe('29.4-30.6');
  });

  it('builds a bullion basis from quantity, weight, and purity', () => {
    const metadata = buildLotSearchMetadata(
      'https://www.catawiki.com/es/l/102686290',
      'Venezuela - Simon Bolivar - 1 Bolivar 1960/1965 - lot of 4 coins',
      'es',
    );

    expect(buildBullionBasis(metadata, {
      weight: 4.95,
      compositionText: 'Silver (.835)',
    })).toEqual({
      metal: 'silver',
      quantity: 4,
      purity: 0.835,
      unitWeightGrams: 4.95,
      grossWeightGrams: 19.8,
      fineWeightGrams: 16.533,
    });
  });

  it('builds a direct bullion basis from a generic bullion title without Numista', () => {
    const metadata = buildLotSearchMetadata(
      'https://www.catawiki.com/es/l/102797481',
      '1 Troy Ounce Plata .999 Dinosaur 2026 31.1 gram fine silver',
      'es',
    );

    expect(buildDirectBullionBasis(metadata)).toEqual({
      metal: 'silver',
      quantity: 1,
      purity: 0.999,
      unitWeightGrams: 31.1,
      grossWeightGrams: 31.1,
      fineWeightGrams: 31.069,
    });
  });

  it('uses lot context text to infer weight, metal, and purity when the title is too sparse', () => {
    const metadata = buildLotSearchMetadata(
      'https://www.catawiki.com/es/l/102644522',
      'España. Juan Carlos I. 2000 Ptas 1997',
      'es',
      'Metal precioso Plata Peso 18 g Pureza 925/1000',
    );

    expect(metadata.weight).toBe(18);
    expect(metadata.metalHint).toBe('silver');
    expect(buildDirectBullionBasis(metadata)).toEqual({
      metal: 'silver',
      quantity: 1,
      purity: 0.925,
      unitWeightGrams: 18,
      grossWeightGrams: 18,
      fineWeightGrams: 16.65,
    });
  });

  it('estimates bullion total from a live-metal quote basis', () => {
    const basis = {
      metal: 'silver' as const,
      quantity: 4,
      purity: 0.835,
      unitWeightGrams: 4.95,
      grossWeightGrams: 19.8,
      fineWeightGrams: 16.533,
    };

    const estimate = estimateBullionValue(basis, {
      currency: 'EUR',
      pricePerOunce: 64.5126,
      updatedAt: '2026-04-10T00:00:00Z',
      source: 'api',
    });

    expect(estimate.spotPricePerGram).toBeCloseTo(2.0741, 4);
    expect(estimate.totalValue).toBeCloseTo(34.3, 1);
  });

  it('selects the issue matching the extracted year', () => {
    expect(pickIssueForYear([
      { id: 1, year: 1998 },
      { id: 2, year: 1999 },
    ], 1999)?.id).toBe(2);
  });

  it('summarizes price ranges by grade', () => {
    const summary = summarizePrices([
      { grade: 'xf', price: 380 },
      { grade: 'f', price: 180 },
      { grade: 'vf', price: 220 },
    ]);

    expect(summary.range).toEqual({ min: 180, max: 380 });
    expect(summary.prices.map((entry) => entry.grade)).toEqual(['f', 'vf', 'xf']);
  });
});
