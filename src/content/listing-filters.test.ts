import { describe, expect, it } from 'vitest';
import { normalizeListingFilters, shouldHideByListingFilters } from './listing-filters';

describe('listing filters', () => {
  it('normalizes numeric filters and booleans', () => {
    expect(normalizeListingFilters({
      maxEstimatedTotal: '120,5',
      maxShipping: 30,
      onlyNoReserve: true,
    })).toEqual({
      maxEstimatedTotal: 120.5,
      maxShipping: 30,
      onlyNoReserve: true,
    });
  });

  it('falls back to defaults for invalid values', () => {
    expect(normalizeListingFilters({
      maxEstimatedTotal: '0',
      maxShipping: -2,
      onlyNoReserve: false,
    })).toEqual({
      maxEstimatedTotal: null,
      maxShipping: null,
      onlyNoReserve: false,
    });
  });

  it('hides cards that exceed the configured filters', () => {
    expect(shouldHideByListingFilters(
      { maxEstimatedTotal: 100, maxShipping: 20, onlyNoReserve: true },
      { total: 120, shipping: 15, isPartial: false, noReserve: true },
    )).toBe(true);

    expect(shouldHideByListingFilters(
      { maxEstimatedTotal: 200, maxShipping: 20, onlyNoReserve: true },
      { total: 120, shipping: 25, isPartial: false, noReserve: true },
    )).toBe(true);

    expect(shouldHideByListingFilters(
      { maxEstimatedTotal: 200, maxShipping: 20, onlyNoReserve: true },
      { total: 120, shipping: 15, isPartial: false, noReserve: false },
    )).toBe(true);
  });

  it('keeps cards visible when filter data does not violate active filters', () => {
    expect(shouldHideByListingFilters(
      { maxEstimatedTotal: 200, maxShipping: 20, onlyNoReserve: false },
      { total: 120, shipping: null, isPartial: true, noReserve: false },
    )).toBe(false);
  });
});
