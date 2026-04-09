export interface ParsedCurrency {
  readonly symbol: string;
  readonly amount: number;
}

export type PriceBreakdown =
  | { readonly total: number; readonly commission: number; readonly shipping: number; readonly isPartial: false }
  | { readonly total: number; readonly commission: number; readonly shipping: null; readonly isPartial: true };

export interface CommissionConfig {
  readonly rate: number;
  readonly fixedFee: number;
}

export interface SelectorConfig {
  readonly primary: string;
  readonly fallbacks: readonly string[];
  readonly validate?: (el: Element) => boolean;
}

export type PageType = 'lot-detail' | 'listing' | 'unknown';

export type CardStatus = 'active' | 'starting' | 'buy-now' | 'final' | 'closed' | 'unknown';
