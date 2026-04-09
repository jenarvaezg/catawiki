import type { SelectorConfig } from './types';

// --- Lot Detail Page Selectors ---

export const LOT_DETAIL = {
  BID_SECTION: {
    primary: '[data-testid="lot-bid-status-section"]',
    fallbacks: [] as string[],
  } satisfies SelectorConfig,

  BID_AMOUNT: {
    primary: '[data-testid="lot-bid-status-section"] [data-sentry-component="Amount"]',
    fallbacks: [
      '[class*="LotBidStatusSection_bid-amount"]',
    ],
  } satisfies SelectorConfig,

  BUYER_PROTECTION: {
    primary: '[data-testid="buyer-protection-statement"]',
    fallbacks: [
      '[class*="LotBidOtherCosts_buyer-protection"]',
    ],
  } satisfies SelectorConfig,

  SHIPPING_FEE: {
    primary: '[data-testid="shipping-fee"]',
    fallbacks: [
      '[data-sentry-component="ShippingCosts"]',
      '[class*="LotShippingInfo_rate"]',
    ],
  } satisfies SelectorConfig,
} as const;

// --- Listing Page Selectors ---

export const LISTING = {
  LOTS_GRID: {
    primary: '[data-testid="lots-grid"]',
    fallbacks: [] as string[],
  } satisfies SelectorConfig,

  LOT_CARD: {
    primary: 'article.c-lot-card__container',
    fallbacks: [] as string[],
  } satisfies SelectorConfig,

  CARD_STATUS: {
    primary: '.c-lot-card__status-text',
    fallbacks: [] as string[],
  } satisfies SelectorConfig,

  CARD_PRICE: {
    primary: '.c-lot-card__price',
    fallbacks: [] as string[],
  } satisfies SelectorConfig,
} as const;

// --- Selector Query Utilities ---

export function queryWithFallback(
  config: SelectorConfig,
  root: Element | Document = document,
): Element | null {
  const primary = root.querySelector(config.primary);
  if (primary) return primary;

  for (const fallback of config.fallbacks) {
    const el = root.querySelector(fallback);
    if (el) return el;
  }

  return null;
}

export function queryAllCards(
  root: Element | Document = document,
): NodeListOf<Element> {
  return root.querySelectorAll(LISTING.LOT_CARD.primary);
}
