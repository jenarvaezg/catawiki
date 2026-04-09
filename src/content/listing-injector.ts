import { LISTING, queryAllCards, queryWithFallback } from './dom-selectors';
import { parseCurrencyAmount } from './currency-parser';
import { calculateTotal, formatCurrency } from './price-calculator';
import { detectLocale, getLabel, getActiveCardStatuses, getSkipCardStatuses } from './i18n';
import { EXT_ATTR, CARD_TOTAL_STYLES, applyStyles, createExtElement } from './styles';

function getCardStatus(card: Element, locale: string): 'process' | 'skip' {
  const statusEl = queryWithFallback(LISTING.CARD_STATUS, card);
  const statusText = statusEl?.textContent?.trim() ?? '';

  if (statusText === '') return 'skip';

  const skipStatuses = getSkipCardStatuses(locale);
  if (skipStatuses.some((s) => statusText.includes(s))) return 'skip';

  const activeStatuses = getActiveCardStatuses(locale);
  if (activeStatuses.some((s) => statusText.includes(s))) return 'process';

  // Unrecognized status: default to process (handles future Catawiki status texts)
  return 'process';
}

function injectCardTotal(card: Element, locale: string): void {
  // Skip if already injected
  if (card.querySelector(`[${EXT_ATTR}="card-total"]`)) return;

  // Check card status
  if (getCardStatus(card, locale) === 'skip') return;

  // Find and parse price
  const priceEl = queryWithFallback(LISTING.CARD_PRICE, card);
  if (!priceEl?.textContent) return;

  const parsed = parseCurrencyAmount(priceEl.textContent);
  if (!parsed) return;

  // Calculate partial total (no shipping on listing pages)
  const breakdown = calculateTotal(parsed.amount, null);

  // Create and inject label
  const totalLabel = createExtElement('span', 'card-total');
  applyStyles(totalLabel, CARD_TOTAL_STYLES);
  totalLabel.textContent = `${getLabel('total_price', locale)}: ${formatCurrency(breakdown.total, parsed.symbol, locale)} (${getLabel('excl_shipping', locale)})`;

  priceEl.after(totalLabel);
}

export function injectListingTotals(): void {
  const locale = detectLocale();
  const cards = queryAllCards();
  cards.forEach((card) => injectCardTotal(card, locale));
}

export function updateListingTotals(): void {
  // Only inject on cards that don't already have a total (idempotent)
  injectListingTotals();
}
