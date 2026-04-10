import { describe, expect, it } from 'vitest';
import { getNextMinimumBid, getTargetBidAmount } from './bid-increments';

describe('getNextMinimumBid', () => {
  it('uses the official Catawiki increment table across boundaries', () => {
    expect(getNextMinimumBid(1)).toBe(2);
    expect(getNextMinimumBid(10)).toBe(11);
    expect(getNextMinimumBid(11)).toBe(16);
    expect(getNextMinimumBid(100)).toBe(105);
    expect(getNextMinimumBid(101)).toBe(111);
    expect(getNextMinimumBid(200)).toBe(210);
    expect(getNextMinimumBid(220)).toBe(240);
    expect(getNextMinimumBid(500)).toBe(520);
    expect(getNextMinimumBid(501)).toBe(551);
    expect(getNextMinimumBid(1000)).toBe(1050);
    expect(getNextMinimumBid(1001)).toBe(1101);
    expect(getNextMinimumBid(500000)).toBe(520000);
    expect(getNextMinimumBid(500001)).toBe(550001);
  });
});

describe('getTargetBidAmount', () => {
  it('keeps the displayed amount for starting bids', () => {
    expect(getTargetBidAmount('starting', 1)).toBe(1);
  });

  it('keeps the displayed amount for buy-now lots', () => {
    expect(getTargetBidAmount('buy-now', 420)).toBe(420);
  });

  it('calculates the next minimum bid for active lots', () => {
    expect(getTargetBidAmount('current', 220)).toBe(240);
  });
});
