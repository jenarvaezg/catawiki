import type { ParsedCurrency, PriceBreakdown, CommissionConfig, CardStatus, PageType } from '../content/types';

export type PlatformId = 'catawiki' | 'wallapop' | 'vinted';

export interface CardContext {
  readonly priceElement: Element;
  readonly price: ParsedCurrency;
  readonly targetPrice: number;
  readonly status: CardStatus;
  readonly productId: string | null;
  readonly productUrl: string | null;
  readonly title: string;
  readonly shippingHint: number | null;
  readonly noReserve: boolean;
  /** Platform-specific commission hint. Overrides getCommissionForPrice/defaultCommissionConfig when set. */
  readonly commissionHint?: CommissionConfig;
}

export interface CostDetails {
  readonly shippingCost: number | null;
  readonly commissionConfig: CommissionConfig | undefined;
}

export interface Platform {
  readonly id: PlatformId;
  readonly name: string;

  // --- Routing ---
  detectPageType(url: string): PageType;
  detectLocale(url?: string): string;

  // --- Product identification ---
  extractProductId(url: string): string | null;
  getCanonicalProductUrl(url: string): string | null;

  // --- Listing page ---
  queryAllCards(root?: Element | Document): Element[];
  extractCardContext(card: Element, locale: string): CardContext | null;
  getCardItemContainer(card: Element): HTMLElement;

  // --- Detail page ---
  getDetailInjectionAnchor(doc?: Document): Element | null;
  findProductTitle(doc?: Document): string;
  findProductContextText(doc?: Document): string;

  // --- Cost resolution from fetched HTML ---
  extractCostFromHtml(html: string): CostDetails;

  // --- Pricing ---
  readonly defaultCommissionConfig: CommissionConfig;

  /**
   * Returns the commission/buyer-fee config for a specific price point.
   * Use this for platforms with tiered fee structures (e.g. Wallapop Protection).
   * Falls back to `defaultCommissionConfig` if not implemented.
   */
  getCommissionForPrice?(price: number): CommissionConfig;
}
