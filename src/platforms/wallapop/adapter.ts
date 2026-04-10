import type { Platform, PlatformId, CardContext, CostDetails } from '../platform';
import type { CommissionConfig, CardStatus, PageType } from '../../content/types';
import { parseCurrencyAmount } from '../../content/currency-parser';
import { getDefaultCoinShippingEstimate } from './shipping';

const NO_COMMISSION: CommissionConfig = { rate: 0, fixedFee: 0 };

/**
 * Wallapop "Protección Wallapop" buyer fee tiers (April 2026).
 * Charged to the buyer when purchasing via Wallapop Envíos.
 *
 *   1€ – 13€:        fixed 1.69€
 *   13.01€ – 657€:   0.69€ + 7.5% of price
 *   657.01€ – 2500€: fixed 50€
 */
function getWallapopProtectionConfig(price: number): CommissionConfig {
  if (price <= 13) return { rate: 0, fixedFee: 1.69 };
  if (price <= 657) return { rate: 0.075, fixedFee: 0.69 };
  return { rate: 0, fixedFee: 50 };
}

const WALLAPOP_HOSTS = [
  'wallapop.com',
  'es.wallapop.com',
  'it.wallapop.com',
  'pt.wallapop.com',
  'uk.wallapop.com',
] as const;

// --- URL detection ---

function isWallapopHost(hostname: string): boolean {
  return WALLAPOP_HOSTS.some((h) => hostname === h || hostname.endsWith(`.wallapop.com`));
}

function isItemPage(url: URL): boolean {
  return /^\/item\/[^/]+/.test(url.pathname);
}

function isSearchPage(url: URL): boolean {
  return /^\/(?:app\/)?search(?:\/|$|\?)/.test(url.pathname + url.search);
}

function isCategoryPage(url: URL): boolean {
  return /^\/app\/catalog\//.test(url.pathname);
}

function isUserProfilePage(url: URL): boolean {
  return /^\/user\/[^/]+/.test(url.pathname);
}

// --- Product ID extraction ---

function extractItemSlug(url: string): string | null {
  try {
    const pathname = new URL(url, 'https://es.wallapop.com').pathname;
    const match = pathname.match(/^\/item\/([^/?#]+)/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

// --- Card selectors (based on real Wallapop DOM, April 2026) ---
// Class names use CSS modules with hashes (e.g., ItemCard__price__pVpdc)
// We use attribute-contains selectors for stability across deploys.

function findAllCards(root: Element | Document): Element[] {
  const cards = root.querySelectorAll('a[href^="/item/"]');
  return Array.from(cards);
}

function getItemUrl(card: Element): string | null {
  // The card itself is the <a> element
  if (card instanceof HTMLAnchorElement && card.href.includes('/item/')) {
    return card.href;
  }
  const link =
    card.closest<HTMLAnchorElement>('a[href*="/item/"]')
    ?? card.querySelector<HTMLAnchorElement>('a[href*="/item/"]');
  return link?.href ?? null;
}

function findPriceElement(card: Element): { element: Element; parsed: NonNullable<ReturnType<typeof parseCurrencyAmount>> } | null {
  // Primary: Wallapop's ItemCard price element
  const primarySelectors = [
    'strong[class*="ItemCard__price"]',
    '[class*="ItemCard__price"]',
  ];

  for (const sel of primarySelectors) {
    const el = card.querySelector(sel);
    if (el?.textContent) {
      const parsed = parseCurrencyAmount(el.textContent);
      if (parsed) return { element: el, parsed };
    }
  }

  // Fallback: scan short text elements for currency amounts
  const candidates = card.querySelectorAll('strong, span, p');
  for (const el of candidates) {
    if (el.children.length > 2) continue;
    const text = el.textContent?.trim() ?? '';
    if (text.length > 20) continue;
    const parsed = parseCurrencyAmount(text);
    if (parsed) return { element: el, parsed };
  }

  return null;
}

function getCardTitle(card: Element): string {
  const candidates = [
    card.querySelector<HTMLElement>('h3[class*="ItemCard__title"]')?.textContent,
    card.querySelector<HTMLElement>('h3')?.textContent,
    card.querySelector<HTMLElement>('img[alt]')?.getAttribute('alt'),
  ];

  const title = candidates
    .map((v) => v?.trim() ?? '')
    .find((v) => v !== '');

  return title ?? 'Unknown item';
}

function getBadgeTypes(card: Element): Set<string> {
  const badges = card.querySelectorAll('wallapop-badge');
  const types = new Set<string>();
  badges.forEach((badge) => {
    const type = badge.getAttribute('badge-type');
    if (type) types.add(type);
  });
  return types;
}

function isReservedOrSold(card: Element): boolean {
  const badgeTypes = getBadgeTypes(card);
  if (badgeTypes.has('reserved') || badgeTypes.has('sold')) return true;

  // Fallback: check shadow DOM text and attributes
  const badges = card.querySelectorAll('wallapop-badge');
  for (const badge of badges) {
    const text = badge.getAttribute('text')?.toLowerCase() ?? '';
    if (/reservado|vendido|reserved|sold/.test(text)) return true;
  }

  return false;
}

function getShippingStatus(card: Element): 'available' | 'none' | 'unknown' {
  const badgeTypes = getBadgeTypes(card);

  if (badgeTypes.has('shippingAvailable')) return 'available';

  // Check badge text attributes for shipping-related info
  const badges = card.querySelectorAll('wallapop-badge');
  for (const badge of badges) {
    const text = badge.getAttribute('text')?.toLowerCase() ?? '';
    if (/envío disponible|shipping available/i.test(text)) return 'available';
    if (/sólo venta en persona|solo venta en persona|only in person/i.test(text)) return 'none';
  }

  return 'unknown';
}

// --- Detail page ---

const SHIPPING_COST_RE = /(?:desde|from)\s+(\d+[.,]\d{2})\s*€/i;
const SHIPPING_COST_RE_ALT = /(?:desde|from)\s+€?\s*(\d+[.,]\d{2})/i;

export class WallapopPlatform implements Platform {
  readonly id: PlatformId = 'wallapop';
  readonly name = 'Wallapop';
  readonly defaultCommissionConfig: CommissionConfig = { rate: 0.075, fixedFee: 0.69 };

  getCommissionForPrice(price: number): CommissionConfig {
    return getWallapopProtectionConfig(price);
  }

  detectPageType(url: string): PageType {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return 'unknown';
    }

    if (!isWallapopHost(parsed.hostname)) return 'unknown';

    if (isItemPage(parsed)) return 'lot-detail';
    if (isSearchPage(parsed) || isCategoryPage(parsed) || isUserProfilePage(parsed)) return 'listing';

    return 'unknown';
  }

  detectLocale(_url?: string): string {
    const hostname = window.location.hostname;
    if (hostname.startsWith('uk.')) return 'en';
    if (hostname.startsWith('it.')) return 'it';
    if (hostname.startsWith('pt.')) return 'pt';
    return 'es';
  }

  extractProductId(url: string): string | null {
    return extractItemSlug(url);
  }

  getCanonicalProductUrl(url: string): string | null {
    const slug = extractItemSlug(url);
    if (!slug) return null;
    try {
      const parsed = new URL(url);
      return `${parsed.origin}/item/${slug}`;
    } catch {
      return null;
    }
  }

  queryAllCards(root?: Element | Document): Element[] {
    return findAllCards(root ?? document);
  }

  extractCardContext(card: Element, _locale: string): CardContext | null {
    if (isReservedOrSold(card)) return null;

    const priceResult = findPriceElement(card);
    if (!priceResult) return null;

    const itemUrl = getItemUrl(card);
    const productId = itemUrl ? extractItemSlug(itemUrl) : null;
    const canonicalUrl = itemUrl ? this.getCanonicalProductUrl(itemUrl) : null;

    const shipping = getShippingStatus(card);
    // Wallapop Protection fee only applies when using Wallapop Envíos.
    // In-person sales have no buyer fee.
    const commissionHint = shipping === 'available'
      ? getWallapopProtectionConfig(priceResult.parsed.amount)
      : NO_COMMISSION;

    return {
      priceElement: priceResult.element,
      price: priceResult.parsed,
      targetPrice: priceResult.parsed.amount,
      status: 'buy-now' as CardStatus,
      productId,
      productUrl: canonicalUrl,
      title: getCardTitle(card),
      shippingHint: shipping === 'available' ? getDefaultCoinShippingEstimate() : null,
      noReserve: true,
      commissionHint,
    };
  }

  getCardItemContainer(card: Element): HTMLElement {
    // On Wallapop, the card IS the <a> element which is the top-level item
    // In some layouts it may be wrapped in a <li> or similar
    const listItem = card.closest<HTMLElement>('li, [role="listitem"]');
    if (listItem) return listItem;
    return card as HTMLElement;
  }

  getDetailInjectionAnchor(doc?: Document): Element | null {
    const root = doc ?? document;

    // Primary: Wallapop's price section on detail page
    const priceEl = root.querySelector('[class*="ItemDetailPrice"]');
    if (priceEl) return priceEl;

    // Fallback: the content section
    const contentSection = root.querySelector('section[class*="ItemDetailTwoColumns__content"]');
    if (contentSection) return contentSection;

    // Last resort: h1 title
    const h1 = root.querySelector('h1[class*="ItemDetail"]') ?? root.querySelector('h1');
    return h1;
  }

  findProductTitle(doc?: Document): string {
    const root = doc ?? document;

    const h1 = root.querySelector('h1[class*="ItemDetail"]')?.textContent?.trim()
      ?? root.querySelector('h1')?.textContent?.trim();
    if (h1) return h1;

    const ogTitle = root.querySelector('meta[property="og:title"]')?.getAttribute('content')?.trim();
    if (ogTitle) return ogTitle;

    const slug = window.location.pathname.split('/').at(-1) ?? '';
    return slug.replace(/-\d+$/, '').replace(/-/g, ' ').trim() || document.title.trim();
  }

  findProductContextText(doc?: Document): string {
    const root = doc ?? document;

    // Try the content section first
    const contentSection = root.querySelector('section[class*="ItemDetailTwoColumns__content"]');
    const source = contentSection?.textContent ?? root.querySelector('main')?.textContent ?? '';
    const normalized = source.replace(/\s+/g, ' ').trim();
    if (normalized === '') return '';

    return normalized
      .split(/\b(?:Productos relacionados|También te puede interesar|Artículos similares|Otros productos)\b/i)[0]
      ?.trim() ?? normalized;
  }

  extractCostFromHtml(html: string): CostDetails {
    const doc = new DOMParser().parseFromString(html, 'text/html');

    // Narrow to item detail section to avoid false positives from footer/ads/banners.
    // Wallapop is an SPA — the fetched HTML may only contain the SSR shell.
    const detailSection = doc.querySelector('[class*="ItemDetailTwoColumns__content"]')
      ?? doc.querySelector('main')
      ?? doc.body;
    const normalizedText = (detailSection.textContent ?? '').replace(/\s+/g, ' ');

    let shippingCost: number | null = null;

    // 1. Extract explicit shipping cost: "desde 2,55 €"
    const match = SHIPPING_COST_RE.exec(normalizedText) ?? SHIPPING_COST_RE_ALT.exec(normalizedText);
    if (match) {
      const amount = parseFloat(match[1].replace(',', '.'));
      if (Number.isFinite(amount)) {
        shippingCost = amount;
      }
    }

    // 2. Detect free shipping only from item-specific content (not global text)
    if (shippingCost === null && /envío gratis/i.test(normalizedText)) {
      shippingCost = 0;
    }

    // 3. Don't guess — if we can't find explicit shipping info, return null.
    //    The listing injector will show "sin envío" (excl. shipping).

    // Don't return commissionConfig — let the tiered getCommissionForPrice() handle it.
    // Returning undefined here means the listing-injector will use the platform's tiered fee.
    return {
      shippingCost,
      commissionConfig: undefined,
    };
  }
}
