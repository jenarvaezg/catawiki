type BiddableCardStatus = 'current' | 'starting' | 'buy-now';

const BID_INCREMENTS: ReadonlyArray<readonly [max: number, increment: number]> = [
  [10, 1],
  [100, 5],
  [200, 10],
  [500, 20],
  [1000, 50],
  [2000, 100],
  [5000, 200],
  [10000, 500],
  [20000, 1000],
  [50000, 2000],
  [100000, 5000],
  [200000, 10000],
  [500000, 20000],
] as const;

export function getNextMinimumBid(currentBid: number): number {
  for (const [max, increment] of BID_INCREMENTS) {
    if (currentBid <= max) {
      return currentBid + increment;
    }
  }

  return currentBid + 50000;
}

export function getTargetBidAmount(status: BiddableCardStatus, displayedAmount: number): number {
  if (status === 'current') {
    return getNextMinimumBid(displayedAmount);
  }

  return displayedAmount;
}
