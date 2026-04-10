import { LISTING, queryAllCards, queryWithFallback } from './dom-selectors';
import { parseCurrencyAmount } from './currency-parser';
import { calculateTotal, formatCurrency } from './price-calculator';
import { getCardStatus, detectLocale, getLabel } from './i18n';
import { resolveLotCostDetails } from './lot-cost-resolver';
import { getTargetBidAmount } from './bid-increments';
import { getCanonicalLotUrl } from './lot-url';
import {
  EXT_ATTR,
  CARD_TOTAL_STYLES,
  CARD_TOTAL_LABEL_STYLES,
  CARD_TOTAL_AMOUNT_STYLES,
  CARD_TOTAL_BREAKDOWN_STYLES,
  applyStyles,
  createExtElement,
} from './styles';
import type { CardStatus, ParsedCurrency, PriceBreakdown } from './types';

type BiddableCardStatus = Extract<CardStatus, 'current' | 'starting' | 'buy-now'>;

interface ListingCardContext {
  readonly priceEl: Element;
  readonly parsedPrice: ParsedCurrency;
  readonly targetBidAmount: number;
  readonly status: BiddableCardStatus;
  readonly lotUrl: string | null;
  readonly shippingHint: number | null;
}

interface CardTotalElements {
  readonly root: HTMLElement;
  readonly label: HTMLElement;
  readonly amount: HTMLElement;
  readonly breakdown: HTMLElement;
}

function findCardStatusEl(card: Element): Element | null {
  const bySelector = queryWithFallback(LISTING.CARD_STATUS, card);
  if (bySelector) {
    const statusText = bySelector.textContent?.trim() ?? '';
    if (statusText !== '') return bySelector;
  }

  return Array.from(card.querySelectorAll('p, span, div'))
    .find((el) => /\b(current bid|starting bid|buy now|puja actual|puja inicial|comprar ahora)\b/i.test(el.textContent ?? ''))
    ?? null;
}

function findCardPriceEl(card: Element): Element | null {
  const bySelector = queryWithFallback(LISTING.CARD_PRICE, card);
  if (bySelector && parseCurrencyAmount(bySelector.textContent ?? '') !== null) {
    return bySelector;
  }

  return Array.from(card.querySelectorAll('p, span, div'))
    .find((el) => parseCurrencyAmount(el.textContent ?? '') !== null)
    ?? null;
}

function resolveCardStatus(card: Element, locale: string): CardStatus {
  const statusEl = findCardStatusEl(card);
  const statusText = statusEl?.textContent?.trim() ?? '';

  if (statusText === '') return 'unknown';

  const resolved = getCardStatus(locale, statusText);
  return resolved === 'unknown' ? 'current' : resolved;
}

function isBiddableStatus(status: CardStatus): status is BiddableCardStatus {
  return status === 'current' || status === 'starting' || status === 'buy-now';
}

function getCardLotUrl(card: Element): string | null {
  const link =
    card.closest<HTMLAnchorElement>('a[href*="/l/"], a[href*="view_lot="]')
    ?? card.querySelector<HTMLAnchorElement>('a[href*="/l/"], a[href*="view_lot="]');
  if (!link?.href) return null;
  return getCanonicalLotUrl(link.href);
}

function hasFreeShippingBadge(card: Element, locale: string): boolean {
  const cardText = card.textContent?.toLowerCase() ?? '';
  return cardText.includes(getLabel('free_shipping', locale).toLowerCase());
}

function buildCardTotal(locale: string, status: BiddableCardStatus): CardTotalElements {
  const root = createExtElement('div', 'card-total');
  applyStyles(root, CARD_TOTAL_STYLES);

  const label = document.createElement('span');
  applyStyles(label, CARD_TOTAL_LABEL_STYLES);
  label.textContent = status === 'buy-now' ? getLabel('total_price', locale) : getLabel('next_bid_total', locale);
  root.appendChild(label);

  const amount = document.createElement('span');
  applyStyles(amount, CARD_TOTAL_AMOUNT_STYLES);
  amount.textContent = getLabel('calculating', locale);
  root.appendChild(amount);

  const breakdown = document.createElement('span');
  applyStyles(breakdown, CARD_TOTAL_BREAKDOWN_STYLES);
  root.appendChild(breakdown);

  return { root, label, amount, breakdown };
}

function formatCardBreakdown(breakdown: PriceBreakdown, symbol: string, locale: string): string {
  const commissionText = `${getLabel('commission', locale)}: ${formatCurrency(breakdown.commission, symbol, locale)}`;

  let shippingText: string;
  if (breakdown.isPartial) {
    shippingText = getLabel('excl_shipping', locale);
  } else if (breakdown.shipping === 0) {
    shippingText = getLabel('free_shipping', locale);
  } else {
    shippingText = `${getLabel('shipping', locale)}: ${formatCurrency(breakdown.shipping, symbol, locale)}`;
  }

  return `${commissionText} · ${shippingText}`;
}

function buildCardContext(card: Element, locale: string): ListingCardContext | null {
  const status = resolveCardStatus(card, locale);
  if (!isBiddableStatus(status)) return null;

  const priceEl = findCardPriceEl(card);
  if (!priceEl?.textContent) return null;

  const parsedPrice = parseCurrencyAmount(priceEl.textContent);
  if (!parsedPrice) return null;

  return {
    priceEl,
    parsedPrice,
    targetBidAmount: getTargetBidAmount(status, parsedPrice.amount),
    status,
    lotUrl: getCardLotUrl(card),
    shippingHint: hasFreeShippingBadge(card, locale) ? 0 : null,
  };
}

async function populateCardTotal(
  totalEl: CardTotalElements,
  context: ListingCardContext,
  locale: string,
): Promise<void> {
  let shippingCost = context.shippingHint;
  let commissionConfig;

  if (context.lotUrl) {
    try {
      const details = await resolveLotCostDetails(context.lotUrl);
      shippingCost = details.shippingCost ?? shippingCost;
      commissionConfig = details.commissionConfig;
    } catch (error) {
      console.warn('[Catawiki Price Ext] Failed to resolve lot costs for listing card:', context.lotUrl, error);
    }
  }

  const breakdown = calculateTotal(context.targetBidAmount, shippingCost, commissionConfig);
  totalEl.amount.textContent = formatCurrency(breakdown.total, context.parsedPrice.symbol, locale);
  totalEl.breakdown.textContent = formatCardBreakdown(breakdown, context.parsedPrice.symbol, locale);
}

function injectCardTotal(card: Element, locale: string): void {
  if (card.querySelector(`[${EXT_ATTR}="card-total"]`)) return;

  const context = buildCardContext(card, locale);
  if (!context) return;

  const totalEl = buildCardTotal(locale, context.status);
  context.priceEl.after(totalEl.root);

  void populateCardTotal(totalEl, context, locale);
}

export function injectListingTotals(): void {
  const locale = detectLocale();
  const cards = queryAllCards();
  cards.forEach((card) => injectCardTotal(card, locale));
}

export function updateListingTotals(): void {
  injectListingTotals();
}
