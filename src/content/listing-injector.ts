import { LISTING, queryAllCards, queryWithFallback } from './dom-selectors';
import { parseCurrencyAmount } from './currency-parser';
import { getIgnoredLotIds, ignoreLot, shouldHideIgnoredLot } from './ignored-lots';
import { getListingFilters, shouldHideByListingFilters, type ListingFilters } from './listing-filters';
import { calculateTotal, formatCurrency } from './price-calculator';
import { getCardStatus, detectLocale, getLabel } from './i18n';
import { resolveLotCostDetails } from './lot-cost-resolver';
import { getTargetBidAmount } from './bid-increments';
import { getCanonicalLotUrl, getLotIdFromUrl } from './lot-url';
import type { ResolveBullionValueResponse } from '../shared/messages';
import { buildDirectBullionBasis, buildLotSearchMetadata, buildMarketCacheFingerprint } from '../shared/numista';
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
  readonly lotId: string | null;
  readonly lotUrl: string | null;
  readonly shippingHint: number | null;
}

interface CardTotalElements {
  readonly root: HTMLElement;
  readonly label: HTMLElement;
  readonly amount: HTMLElement;
  readonly breakdown: HTMLElement;
  readonly badge: HTMLElement;
}

interface CardLotIdentity {
  readonly lotId: string | null;
  readonly lotUrl: string | null;
}

const NO_RESERVE_RE = /\b(?:sin precio de reserva|zonder minimumprijs|zonder reserveprijs|without reserve price|no reserve price|sans prix de réserve)\b/i;
const CARD_IGNORE_BUTTON_STYLES: Record<string, string> = {
  position: 'absolute',
  top: '10px',
  right: '10px',
  width: '32px',
  height: '32px',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: '1px solid rgba(26, 26, 26, 0.12)',
  borderRadius: '999px',
  backgroundColor: 'rgba(255, 255, 255, 0.96)',
  color: '#1A1A1A',
  fontSize: '16px',
  lineHeight: '1',
  cursor: 'pointer',
  zIndex: '4',
  boxShadow: '0 2px 6px rgba(0, 0, 0, 0.12)',
};

const CARD_SELECTORS = [LISTING.LOT_CARD.primary, ...LISTING.LOT_CARD.fallbacks];
const bullionBadgeCache = new Map<string, Promise<ResolveBullionValueResponse['result'] | null>>();

function runtimeSendMessage<T>(message: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    const runtime = globalThis.chrome?.runtime;
    if (!runtime?.sendMessage) {
      reject(new Error('Extension messaging unavailable'));
      return;
    }

    runtime.sendMessage(message, (response: T) => {
      const runtimeError = globalThis.chrome?.runtime?.lastError;
      if (runtimeError) {
        reject(new Error(runtimeError.message ?? 'Runtime messaging failed'));
        return;
      }

      resolve(response);
    });
  });
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

function getCardLotIdentity(card: Element): CardLotIdentity {
  const lotUrl = getCardLotUrl(card);
  return {
    lotId: lotUrl ? getLotIdFromUrl(lotUrl) : null,
    lotUrl,
  };
}

function getCardTitle(card: Element, lotId: string | null): string {
  const titleCandidates = [
    card.querySelector<HTMLElement>('img[alt]')?.getAttribute('alt'),
    card.querySelector<HTMLElement>('[class*="title"]')?.textContent,
    card.querySelector<HTMLElement>('h2, h3, h4')?.textContent,
    card.querySelector<HTMLAnchorElement>('a[href*="/l/"], a[href*="view_lot="]')?.getAttribute('aria-label'),
  ];

  const title = titleCandidates
    .map((value) => value?.trim() ?? '')
    .find((value) => value !== '');

  return title ?? (lotId ? `Lot ${lotId}` : 'Ignored lot');
}

function formatPercentDelta(value: number, locale: string): string {
  const rounded = Math.round(value * 10) / 10;
  const absolute = Math.abs(rounded);
  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: absolute < 10 && absolute % 1 !== 0 ? 1 : 0,
    maximumFractionDigits: 1,
  }).format(absolute);
  const sign = rounded > 0 ? '+' : rounded < 0 ? '-' : '±';
  return `${sign}${formatted}%`;
}

function updateBullionBadge(
  badgeEl: HTMLElement,
  premiumPercent: number,
  bullionValue: number,
  locale: string,
): void {
  const isDiscount = premiumPercent <= 0;
  badgeEl.style.display = 'inline-flex';
  badgeEl.style.backgroundColor = isDiscount ? '#E7F8EE' : '#FDECEC';
  badgeEl.style.color = isDiscount ? '#0E7A32' : '#B42318';
  badgeEl.textContent = `${getLabel('bullion_badge', locale)} ${formatPercentDelta(premiumPercent, locale)}`;
  badgeEl.title = `${getLabel('bullion_badge', locale)} ${formatMoney(bullionValue, 'EUR', locale)}`;
}

async function resolveCardBullionValue(
  card: Element,
  locale: string,
  lotUrl: string | null,
): Promise<number | null> {
  const title = getCardTitle(card, getCardLotIdentity(card).lotId);
  const metadata = buildLotSearchMetadata(
    lotUrl ?? window.location.href,
    title,
    locale,
  );

  if (!buildDirectBullionBasis(metadata)) {
    return null;
  }

  const cacheKey = buildMarketCacheFingerprint(metadata);
  const cached = bullionBadgeCache.get(cacheKey);
  if (cached) {
    const result = await cached;
    return result?.status === 'ok' && result.estimate ? result.estimate.totalValue : null;
  }

  const pending = runtimeSendMessage<ResolveBullionValueResponse>({
    type: 'resolve-bullion-value',
    metadata,
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error(response.error);
      }
      return response.result;
    })
    .catch((error) => {
      bullionBadgeCache.delete(cacheKey);
      console.warn('[Catawiki Price Ext] Failed to resolve bullion badge:', error);
      return null;
    });

  bullionBadgeCache.set(cacheKey, pending);
  const result = await pending;
  return result?.status === 'ok' && result.estimate ? result.estimate.totalValue : null;
}

function hasFreeShippingBadge(card: Element, locale: string): boolean {
  const cardText = card.textContent?.toLowerCase() ?? '';
  return cardText.includes(getLabel('free_shipping', locale).toLowerCase());
}

function hasNoReserveBadge(card: Element): boolean {
  return NO_RESERVE_RE.test(card.textContent ?? '');
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

  const badge = document.createElement('span');
  applyStyles(badge, {
    display: 'none',
    marginTop: '6px',
    width: 'fit-content',
    padding: '3px 8px',
    borderRadius: '999px',
    fontSize: '10px',
    fontWeight: '700',
    lineHeight: '1.2',
  });
  root.appendChild(badge);

  return { root, label, amount, breakdown, badge };
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

  const identity = getCardLotIdentity(card);

  return {
    priceEl,
    parsedPrice,
    targetBidAmount: getTargetBidAmount(status, parsedPrice.amount),
    status,
    lotId: identity.lotId,
    lotUrl: identity.lotUrl,
    shippingHint: hasFreeShippingBadge(card, locale) ? 0 : null,
  };
}

async function populateCardTotal(
  card: Element,
  totalEl: CardTotalElements,
  context: ListingCardContext,
  locale: string,
  filters: ListingFilters,
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
  totalEl.badge.style.display = 'none';

  if (card instanceof HTMLElement) {
    card.dataset.catawikiExtTotal = String(breakdown.total);
    if (breakdown.shipping !== null) {
      card.dataset.catawikiExtShipping = String(breakdown.shipping);
    } else {
      delete card.dataset.catawikiExtShipping;
    }
    card.dataset.catawikiExtPartial = String(breakdown.isPartial);
    applyListingFiltersToCard(card, filters);
  }

  const bullionValue = await resolveCardBullionValue(card, locale, context.lotUrl);
  if (bullionValue !== null && bullionValue > 0) {
    const premiumPercent = ((breakdown.total - bullionValue) / bullionValue) * 100;
    updateBullionBadge(totalEl.badge, premiumPercent, bullionValue, locale);
  }
}

function countCardsWithin(element: Element): number {
  const nestedCards = queryAllCards(element).length;
  const includesSelf = CARD_SELECTORS.some((selector) => element.matches(selector));
  return nestedCards + (includesSelf ? 1 : 0);
}

function getCardItemTarget(card: Element): HTMLElement {
  const listItem = card.closest<HTMLElement>('li, [role="listitem"]');
  if (listItem && countCardsWithin(listItem) === 1) return listItem;

  const parent = card.parentElement;
  if (
    parent instanceof HTMLAnchorElement
    && /\/l\/|view_lot=/.test(parent.href)
    && countCardsWithin(parent) === 1
  ) {
    return parent;
  }

  return card as HTMLElement;
}

function setFilteredVisibility(card: Element, hidden: boolean): void {
  const target = getCardItemTarget(card);
  target.setAttribute('data-catawiki-ext-filter-hidden', hidden ? 'true' : 'false');
  if (hidden) {
    target.style.setProperty('display', 'none', 'important');
  } else {
    target.style.removeProperty('display');
  }
}

function removeIgnoredCard(card: Element): void {
  const removeTarget = getCardItemTarget(card);
  removeTarget.setAttribute('data-catawiki-ext-ignored', 'true');
  removeTarget.remove();
}

function getStoredNumber(card: Element, datasetKey: string): number | null {
  if (!(card instanceof HTMLElement)) return null;
  const rawValue = card.dataset[datasetKey];
  if (!rawValue) return null;
  const parsed = Number.parseFloat(rawValue);
  return Number.isFinite(parsed) ? parsed : null;
}

function getCardFilterData(card: Element) {
  const dataset = card instanceof HTMLElement ? card.dataset : {} as DOMStringMap;
  return {
    total: getStoredNumber(card, 'catawikiExtTotal'),
    shipping: getStoredNumber(card, 'catawikiExtShipping'),
    isPartial: dataset.catawikiExtPartial === 'true',
    noReserve: dataset.catawikiExtNoReserve === 'true',
  };
}

function applyListingFiltersToCard(card: Element, filters: ListingFilters): void {
  setFilteredVisibility(card, shouldHideByListingFilters(filters, getCardFilterData(card)));
}

function ensureCardOverlayPosition(card: Element): void {
  if (!(card instanceof HTMLElement)) return;

  const computedPosition = window.getComputedStyle(card).position;
  if (computedPosition === 'static') {
    card.style.position = 'relative';
  }
}

function injectIgnoreButton(card: Element, locale: string, lotId: string): void {
  if (card.querySelector(`[${EXT_ATTR}="card-ignore-button"]`)) return;

  ensureCardOverlayPosition(card);
  const identity = getCardLotIdentity(card);
  const title = getCardTitle(card, lotId);

  const button = createExtElement('button', 'card-ignore-button') as HTMLButtonElement;
  button.type = 'button';
  applyStyles(button, CARD_IGNORE_BUTTON_STYLES);
  button.textContent = '👎';
  button.title = getLabel('ignore_lot', locale);
  button.setAttribute('aria-label', getLabel('ignore_lot', locale));

  button.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();

    button.disabled = true;

    void ignoreLot({
      lotId,
      lotUrl: identity.lotUrl,
      title,
    })
      .then(() => {
        removeIgnoredCard(card);
      })
      .catch((error) => {
        button.disabled = false;
        console.warn('[Catawiki Price Ext] Failed to ignore lot:', lotId, error);
      });
  });

  card.appendChild(button);
}

function injectCardTotal(
  card: Element,
  locale: string,
  ignoredLotIds: ReadonlySet<string>,
  filters: ListingFilters,
): void {
  const identity = getCardLotIdentity(card);
  if (shouldHideIgnoredLot(identity.lotId, ignoredLotIds)) {
    removeIgnoredCard(card);
    return;
  }

  if (card instanceof HTMLElement) {
    card.dataset.catawikiExtNoReserve = String(hasNoReserveBadge(card));
  }
  applyListingFiltersToCard(card, filters);

  if (identity.lotId) {
    injectIgnoreButton(card, locale, identity.lotId);
  }

  if (filters.onlyNoReserve && card instanceof HTMLElement && card.dataset.catawikiExtNoReserve !== 'true') {
    return;
  }

  if (card.querySelector(`[${EXT_ATTR}="card-total"]`)) return;

  const context = buildCardContext(card, locale);
  if (!context) return;

  const totalEl = buildCardTotal(locale, context.status);
  context.priceEl.after(totalEl.root);

  void populateCardTotal(card, totalEl, context, locale, filters);
}

export function injectListingTotals(): void {
  const locale = detectLocale();
  void Promise.all([getIgnoredLotIds(), getListingFilters()])
    .then(([ignoredLotIds, filters]) => {
      const cards = queryAllCards();
      cards.forEach((card) => injectCardTotal(card, locale, ignoredLotIds, filters));
    })
    .catch((error) => {
      console.warn('[Catawiki Price Ext] Failed to load listing state:', error);
      const cards = queryAllCards();
      const fallbackFilters: ListingFilters = {
        maxEstimatedTotal: null,
        maxShipping: null,
        onlyNoReserve: false,
      };
      cards.forEach((card) => injectCardTotal(card, locale, new Set<string>(), fallbackFilters));
    });
}

export function updateListingTotals(): void {
  injectListingTotals();
}
