import type { Platform, CardContext } from '../platforms/platform';
import { getIgnoredLotIds, ignoreLot, shouldHideIgnoredLot } from './ignored-lots';
import { getListingFilters, shouldHideByListingFilters, type ListingFilters } from './listing-filters';
import { calculateTotal, formatCurrency } from './price-calculator';
import { getLabel } from './i18n';
import { resolveLotCostDetails } from './lot-cost-resolver';
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
import type { CardStatus, PriceBreakdown } from './types';

interface CardTotalElements {
  readonly root: HTMLElement;
  readonly label: HTMLElement;
  readonly amount: HTMLElement;
  readonly breakdown: HTMLElement;
  readonly badge: HTMLElement;
}

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

const bullionBadgeCache = new Map<string, Promise<ResolveBullionValueResponse['result'] | null>>();

// --- Helpers ---

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

function getCardProductUrl(card: Element, platform: Platform): string | null {
  const candidates = [
    card instanceof HTMLAnchorElement ? card : null,
    card.closest<HTMLAnchorElement>('a[href]'),
    card.querySelector<HTMLAnchorElement>('a[href]'),
  ];

  for (const link of candidates) {
    if (!link?.href) continue;
    const canonical = platform.getCanonicalProductUrl(link.href);
    if (canonical) return canonical;
  }
  return null;
}

function getCardProductId(card: Element, platform: Platform): string | null {
  const url = getCardProductUrl(card, platform);
  return url ? platform.extractProductId(url) : null;
}

function getFallbackTitle(card: Element, productId: string | null): string {
  const candidates = [
    card.querySelector<HTMLElement>('img[alt]')?.getAttribute('alt'),
    card.querySelector<HTMLElement>('[class*="title"]')?.textContent,
    card.querySelector<HTMLElement>('h2, h3, h4')?.textContent,
  ];

  const title = candidates
    .map((v) => v?.trim() ?? '')
    .find((v) => v !== '');

  return title ?? (productId ? `Item ${productId}` : 'Ignored item');
}

function formatMoney(amount: number, currency: string, locale: string): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
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
  title: string,
  locale: string,
  productUrl: string | null,
): Promise<number | null> {
  const metadata = buildLotSearchMetadata(
    productUrl ?? window.location.href,
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
      console.warn('[CoinScope Ext] Failed to resolve bullion badge:', error);
      return null;
    });

  bullionBadgeCache.set(cacheKey, pending);
  const result = await pending;
  return result?.status === 'ok' && result.estimate ? result.estimate.totalValue : null;
}

// --- UI Builders ---

function buildCardTotal(locale: string, status: CardStatus): CardTotalElements {
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
  const parts: string[] = [];

  // Only show commission if there is one (Wallapop has none)
  if (breakdown.commission > 0) {
    parts.push(`${getLabel('commission', locale)}: ${formatCurrency(breakdown.commission, symbol, locale)}`);
  }

  if (breakdown.isPartial) {
    parts.push(getLabel('excl_shipping', locale));
  } else if (breakdown.shipping === 0) {
    parts.push(getLabel('free_shipping', locale));
  } else {
    parts.push(`${getLabel('shipping', locale)}: ${formatCurrency(breakdown.shipping, symbol, locale)}`);
  }

  return parts.join(' · ');
}

// --- Card total population ---

async function populateCardTotal(
  card: Element,
  totalEl: CardTotalElements,
  context: CardContext,
  locale: string,
  filters: ListingFilters,
  platform: Platform,
): Promise<void> {
  let shippingCost = context.shippingHint;
  let commissionConfig = context.commissionHint
    ?? platform.getCommissionForPrice?.(context.targetPrice)
    ?? platform.defaultCommissionConfig;

  if (context.productUrl) {
    try {
      const extractFn = (html: string) => platform.extractCostFromHtml(html);
      const details = await resolveLotCostDetails(context.productUrl, extractFn);
      shippingCost = details.shippingCost ?? shippingCost;
      commissionConfig = details.commissionConfig ?? commissionConfig;
    } catch (error) {
      console.warn('[CoinScope Ext] Failed to resolve costs for listing card:', context.productUrl, error);
    }
  }

  const breakdown = calculateTotal(context.targetPrice, shippingCost, commissionConfig);
  totalEl.amount.textContent = formatCurrency(breakdown.total, context.price.symbol, locale);
  totalEl.breakdown.textContent = formatCardBreakdown(breakdown, context.price.symbol, locale);
  totalEl.badge.style.display = 'none';

  if (card instanceof HTMLElement) {
    card.dataset.catawikiExtTotal = String(breakdown.total);
    if (breakdown.shipping !== null) {
      card.dataset.catawikiExtShipping = String(breakdown.shipping);
    } else {
      delete card.dataset.catawikiExtShipping;
    }
    card.dataset.catawikiExtPartial = String(breakdown.isPartial);
    applyListingFiltersToCard(card, filters, platform);
  }

  const bullionValue = await resolveCardBullionValue(context.title, locale, context.productUrl);
  if (bullionValue !== null && bullionValue > 0) {
    const premiumPercent = ((breakdown.total - bullionValue) / bullionValue) * 100;
    updateBullionBadge(totalEl.badge, premiumPercent, bullionValue, locale);
  }
}

// --- Filter & visibility ---

function setFilteredVisibility(card: Element, hidden: boolean, platform: Platform): void {
  const target = platform.getCardItemContainer(card);
  target.setAttribute('data-catawiki-ext-filter-hidden', hidden ? 'true' : 'false');
  if (hidden) {
    target.style.setProperty('display', 'none', 'important');
  } else {
    target.style.removeProperty('display');
  }
}

function removeIgnoredCard(card: Element, platform: Platform): void {
  const removeTarget = platform.getCardItemContainer(card);
  removeTarget.setAttribute('data-catawiki-ext-ignored', 'true');
  removeTarget.style.setProperty('display', 'none', 'important');
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

function applyListingFiltersToCard(card: Element, filters: ListingFilters, platform: Platform): void {
  setFilteredVisibility(card, shouldHideByListingFilters(filters, getCardFilterData(card)), platform);
}

// --- Ignore button ---

function ensureCardOverlayPosition(card: Element): void {
  if (!(card instanceof HTMLElement)) return;

  const computedPosition = window.getComputedStyle(card).position;
  if (computedPosition === 'static') {
    card.style.position = 'relative';
  }
}

function injectIgnoreButton(
  card: Element,
  locale: string,
  productId: string,
  productUrl: string | null,
  title: string,
  platform: Platform,
): void {
  if (card.querySelector(`[${EXT_ATTR}="card-ignore-button"]`)) return;

  ensureCardOverlayPosition(card);

  const button = createExtElement('button', 'card-ignore-button') as HTMLButtonElement;
  button.type = 'button';
  applyStyles(button, CARD_IGNORE_BUTTON_STYLES);
  button.textContent = '\uD83D\uDC4E';
  button.title = getLabel('ignore_lot', locale);
  button.setAttribute('aria-label', getLabel('ignore_lot', locale));

  button.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();

    button.disabled = true;

    void ignoreLot({
      lotId: productId,
      lotUrl: productUrl,
      title,
    })
      .then(() => {
        removeIgnoredCard(card, platform);
      })
      .catch((error) => {
        button.disabled = false;
        console.warn('[CoinScope Ext] Failed to ignore item:', productId, error);
      });
  });

  card.appendChild(button);
}

// --- Card injection orchestrator ---

function injectCardTotal(
  card: Element,
  locale: string,
  ignoredLotIds: ReadonlySet<string>,
  filters: ListingFilters,
  platform: Platform,
): void {
  // Check if card should be hidden (ignored) — use lightweight ID extraction
  const productId = getCardProductId(card, platform);
  if (shouldHideIgnoredLot(productId, ignoredLotIds)) {
    removeIgnoredCard(card, platform);
    return;
  }

  // Extract full card context from platform
  const context = platform.extractCardContext(card, locale);

  // Set noReserve attribute and apply filters
  if (card instanceof HTMLElement) {
    card.dataset.catawikiExtNoReserve = String(context?.noReserve ?? false);
  }
  applyListingFiltersToCard(card, filters, platform);

  // Inject ignore button
  const effectiveProductId = context?.productId ?? productId;
  if (effectiveProductId) {
    const productUrl = context?.productUrl ?? getCardProductUrl(card, platform);
    const title = context?.title ?? getFallbackTitle(card, effectiveProductId);
    injectIgnoreButton(card, locale, effectiveProductId, productUrl, title, platform);
  }

  // Early return for no-reserve filter
  if (filters.onlyNoReserve && card instanceof HTMLElement && card.dataset.catawikiExtNoReserve !== 'true') {
    return;
  }

  // Skip if already injected or no processable context
  if (card.querySelector(`[${EXT_ATTR}="card-total"]`)) return;
  if (!context) return;

  // Create and inject total widget
  const totalEl = buildCardTotal(locale, context.status);
  context.priceElement.after(totalEl.root);

  void populateCardTotal(card, totalEl, context, locale, filters, platform);
}

// --- Entry points ---

export function injectListingTotals(platform: Platform): void {
  const locale = platform.detectLocale();
  void Promise.all([getIgnoredLotIds(), getListingFilters()])
    .then(([ignoredLotIds, filters]) => {
      const cards = platform.queryAllCards();
      cards.forEach((card) => injectCardTotal(card, locale, ignoredLotIds, filters, platform));
    })
    .catch((error) => {
      console.warn('[CoinScope Ext] Failed to load listing state:', error);
      const cards = platform.queryAllCards();
      const fallbackFilters: ListingFilters = {
        maxEstimatedTotal: null,
        maxShipping: null,
        onlyNoReserve: false,
      };
      cards.forEach((card) => injectCardTotal(card, locale, new Set<string>(), fallbackFilters, platform));
    });
}

export function updateListingTotals(platform: Platform): void {
  injectListingTotals(platform);
}
