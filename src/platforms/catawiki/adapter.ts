import type { Platform, PlatformId, CardContext, CostDetails } from '../platform';
import type { CommissionConfig, CardStatus, PageType } from '../../content/types';
import { LISTING, LOT_DETAIL, queryWithFallback, queryAllCards as queryAllCatawikiCards } from '../../content/dom-selectors';
import { getCanonicalLotUrl, getLotIdFromUrl } from '../../content/lot-url';
import { detectPageType as detectCatawikiPageType } from '../../content/page-type';
import { parseCurrencyAmount } from '../../content/currency-parser';
import { getCardStatus, detectLocale as detectCatawikiLocale } from '../../content/i18n';
import { getTargetBidAmount } from '../../content/bid-increments';
import { extractLotCostDetailsFromHtml } from '../../content/lot-cost-resolver';

const DEFAULT_COMMISSION: CommissionConfig = { rate: 0.09, fixedFee: 3 };

const NO_RESERVE_RE = /\b(?:sin precio de reserva|zonder minimumprijs|zonder reserveprijs|without reserve price|no reserve price|sans prix de réserve)\b/i;

const FREE_SHIPPING_LABELS: Record<string, string> = {
  en: 'free shipping',
  es: 'envío gratuito',
  de: 'kostenloser versand',
  fr: 'livraison gratuite',
  nl: 'gratis verzending',
};

type BiddableCardStatus = Extract<CardStatus, 'current' | 'starting' | 'buy-now'>;

function isBiddableStatus(status: CardStatus): status is BiddableCardStatus {
  return status === 'current' || status === 'starting' || status === 'buy-now';
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

function getCardLotUrl(card: Element): string | null {
  const link =
    card.closest<HTMLAnchorElement>('a[href*="/l/"], a[href*="view_lot="]')
    ?? card.querySelector<HTMLAnchorElement>('a[href*="/l/"], a[href*="view_lot="]');
  if (!link?.href) return null;
  return getCanonicalLotUrl(link.href);
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

const CARD_SELECTORS = [LISTING.LOT_CARD.primary, ...LISTING.LOT_CARD.fallbacks];

function countCardsWithin(element: Element): number {
  const nestedCards = queryAllCatawikiCards(element).length;
  const includesSelf = CARD_SELECTORS.some((selector) => element.matches(selector));
  return nestedCards + (includesSelf ? 1 : 0);
}

export class CatawikiPlatform implements Platform {
  readonly id: PlatformId = 'catawiki';
  readonly name = 'Catawiki';
  readonly defaultCommissionConfig: CommissionConfig = DEFAULT_COMMISSION;

  detectPageType(url: string): PageType {
    return detectCatawikiPageType(url);
  }

  detectLocale(_url?: string): string {
    return detectCatawikiLocale();
  }

  extractProductId(url: string): string | null {
    return getLotIdFromUrl(url);
  }

  getCanonicalProductUrl(url: string): string | null {
    try {
      return getCanonicalLotUrl(url);
    } catch {
      return null;
    }
  }

  queryAllCards(root?: Element | Document): Element[] {
    return queryAllCatawikiCards(root ?? document);
  }

  extractCardContext(card: Element, locale: string): CardContext | null {
    const status = resolveCardStatus(card, locale);
    if (!isBiddableStatus(status)) return null;

    const priceEl = findCardPriceEl(card);
    if (!priceEl?.textContent) return null;

    const parsedPrice = parseCurrencyAmount(priceEl.textContent);
    if (!parsedPrice) return null;

    const lotUrl = getCardLotUrl(card);
    const lotId = lotUrl ? getLotIdFromUrl(lotUrl) : null;

    const freeShippingLabel = FREE_SHIPPING_LABELS[locale] ?? FREE_SHIPPING_LABELS.en;
    const cardText = card.textContent?.toLowerCase() ?? '';
    const hasFreeShipping = cardText.includes(freeShippingLabel.toLowerCase());

    return {
      priceElement: priceEl,
      price: parsedPrice,
      targetPrice: getTargetBidAmount(status, parsedPrice.amount),
      status,
      productId: lotId,
      productUrl: lotUrl,
      title: getCardTitle(card, lotId),
      shippingHint: hasFreeShipping ? 0 : null,
      noReserve: NO_RESERVE_RE.test(card.textContent ?? ''),
    };
  }

  getCardItemContainer(card: Element): HTMLElement {
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

  getDetailInjectionAnchor(doc?: Document): Element | null {
    const root = doc ?? document;
    return root.querySelector(`[data-catawiki-ext="total-price"]`)
      ?? queryWithFallback(LOT_DETAIL.BID_SECTION, root);
  }

  findProductTitle(doc?: Document): string {
    const root = doc ?? document;

    const h1 = root.querySelector('h1')?.textContent?.trim();
    if (h1) return h1;

    const ogTitle = root.querySelector('meta[property="og:title"]')?.getAttribute('content')?.trim();
    if (ogTitle) return ogTitle;

    const slug = window.location.pathname.split('/').at(-1) ?? '';
    return slug.replace(/^\d+-/, '').replace(/-/g, ' ').trim() || document.title.trim();
  }

  findProductContextText(doc?: Document): string {
    const root = doc ?? document;
    const main = root.querySelector('main');
    const source = main?.textContent ?? root.body?.textContent ?? document.body.textContent ?? '';
    const normalized = source.replace(/\s+/g, ' ').trim();
    if (normalized === '') return '';

    return normalized
      .split(/\b(?:Otros objetos|Artículos similares|También te pueden gustar|Te puede interesar|You may also like|Similar items|Andere objecten|Autres objets|Andere Artikel)\b/i)[0]
      ?.trim() ?? normalized;
  }

  extractCostFromHtml(html: string): CostDetails {
    return extractLotCostDetailsFromHtml(html);
  }
}
