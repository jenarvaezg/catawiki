import { LOT_DETAIL, queryWithFallback } from './dom-selectors';
import { parseCurrencyAmount } from './currency-parser';
import { calculateTotal, formatCurrency, parseCommissionFromDOM } from './price-calculator';
import { detectLocale, getLabel } from './i18n';
import {
  EXT_ATTR,
  WIDGET_STYLES,
  TOTAL_LABEL_STYLES,
  TOTAL_AMOUNT_STYLES,
  BREAKDOWN_STYLES,
  applyStyles,
  createExtElement,
} from './styles';
import type { CommissionConfig } from './types';

function findBidAmount(): { amount: number; symbol: string } | null {
  const el = queryWithFallback(LOT_DETAIL.BID_AMOUNT);
  if (!el?.textContent) return null;
  return parseCurrencyAmount(el.textContent);
}

function findShippingCost(): number | null {
  const el = queryWithFallback(LOT_DETAIL.SHIPPING_FEE);
  if (!el?.textContent) return null;
  const parsed = parseCurrencyAmount(el.textContent);
  return parsed?.amount ?? null;
}

function findCommissionConfig(): CommissionConfig | null {
  const el = queryWithFallback(LOT_DETAIL.BUYER_PROTECTION);
  if (!el?.textContent) return null;
  return parseCommissionFromDOM(el.textContent);
}

export function removeLotDetailTotal(): void {
  document
    .querySelectorAll(`[${EXT_ATTR}="total-price"], [${EXT_ATTR}="quick-bid-totals-row"], [${EXT_ATTR}="bid-input-total"]`)
    .forEach((el) => el.remove());
  // Clear tracked attributes so listeners can be re-attached
  document
    .querySelectorAll(`[${EXT_ATTR}="bid-input-tracked"]`)
    .forEach((el) => el.removeAttribute(EXT_ATTR));
}

export function injectLotDetailTotal(): void {
  const bid = findBidAmount();
  if (!bid) return;

  const shippingCost = findShippingCost();
  const commissionConfig = findCommissionConfig() ?? undefined;
  const breakdown = calculateTotal(bid.amount, shippingCost, commissionConfig);
  const locale = detectLocale();

  // Build widget
  const widget = createExtElement('div', 'total-price');
  applyStyles(widget, WIDGET_STYLES);

  // Label
  const label = document.createElement('span');
  applyStyles(label, TOTAL_LABEL_STYLES);
  label.textContent = getLabel('total_price', locale);
  widget.appendChild(label);

  // Total amount
  const totalEl = document.createElement('span');
  applyStyles(totalEl, TOTAL_AMOUNT_STYLES);
  totalEl.textContent = formatCurrency(breakdown.total, bid.symbol, locale);
  widget.appendChild(totalEl);

  // Breakdown line
  const breakdownEl = document.createElement('span');
  applyStyles(breakdownEl, BREAKDOWN_STYLES);

  const commissionText = `${getLabel('commission', locale)}: ${formatCurrency(breakdown.commission, bid.symbol, locale)}`;
  const shippingText = breakdown.isPartial
    ? getLabel('excl_shipping', locale)
    : `${getLabel('shipping', locale)}: ${formatCurrency(breakdown.shipping, bid.symbol, locale)}`;

  breakdownEl.textContent = `${commissionText} · ${shippingText}`;
  widget.appendChild(breakdownEl);

  // Inject after bid section
  const bidSection = queryWithFallback(LOT_DETAIL.BID_SECTION);
  if (bidSection) {
    bidSection.after(widget);
  }

  // Inject totals on quick bid buttons
  injectQuickBidTotals(shippingCost, commissionConfig, locale);

  // Set up dynamic totals on bid input fields
  setupBidInputListeners(shippingCost, commissionConfig, locale);
}

function injectQuickBidTotals(
  shippingCost: number | null,
  commissionConfig: CommissionConfig | undefined,
  locale: string,
): void {
  // There can be 2 identical quick-bid containers on the page
  const containers = document.querySelectorAll('[data-testid="quick-bid-buttons"]');
  containers.forEach((container) => {
    // Find the flex row that holds the buttons
    const buttonsRow = container.querySelector('[class*="tw:flex"][class*="tw:gap"]')
      ?? container.querySelector('div > div:last-child');
    if (!buttonsRow || buttonsRow.querySelector(`[${EXT_ATTR}]`)) return;

    const buttons = buttonsRow.querySelectorAll('button');
    if (buttons.length === 0) return;

    // Build a mirror row of totals
    const totalsRow = createExtElement('div', 'quick-bid-totals-row');
    applyStyles(totalsRow, {
      display: 'flex',
      gap: '8px',
      marginTop: '2px',
    });

    buttons.forEach((btn) => {
      const priceSpan = btn.querySelector('.u-typography-h7');
      const parsed = priceSpan?.textContent ? parseCurrencyAmount(priceSpan.textContent) : null;

      const cell = document.createElement('span');
      applyStyles(cell, {
        flex: '1',
        textAlign: 'center',
        fontSize: '10px',
        color: '#888',
        lineHeight: '1.2',
      });

      if (parsed) {
        const breakdown = calculateTotal(parsed.amount, shippingCost, commissionConfig);
        cell.textContent = formatCurrency(breakdown.total, parsed.symbol, locale);
      }

      totalsRow.appendChild(cell);
    });

    buttonsRow.after(totalsRow);
  });
}

function findBidInputs(): HTMLInputElement[] {
  // Primary: known input names (current + legacy)
  const byName = document.querySelectorAll<HTMLInputElement>(
    'input[name="bid"], input[name="directBid"], input[name="maxBid"]',
  );
  if (byName.length > 0) return Array.from(byName);

  // Fallback: numeric inputs near the bid section
  const bidSection = queryWithFallback(LOT_DETAIL.BID_SECTION);
  if (!bidSection) return [];

  // Search in the parent panel (bid inputs may be siblings of the bid status section)
  const searchRoot = bidSection.parentElement ?? bidSection;

  return Array.from(
    searchRoot.querySelectorAll<HTMLInputElement>('input[inputmode="numeric"], input[type="number"]'),
  ).filter((input) => {
    const name = input.name.toLowerCase();
    return !name.includes('search') && !name.includes('email');
  });
}

function findBidInputRow(input: HTMLInputElement): Element | null {
  // Primary: sentry component
  const sentryRow = input.closest('[data-sentry-component="BidInputRow"]');
  if (sentryRow) return sentryRow;

  // Fallback: walk up to find a container that has the currency prefix
  let candidate = input.parentElement;
  for (let depth = 0; candidate && depth < 5; depth++) {
    if (candidate.querySelector('[data-testid="text-field-prefix"]')) return candidate;
    // Also check for a container with the € symbol near the input
    const text = candidate.textContent?.trim() ?? '';
    if (/^[€$£]/.test(text) && candidate.querySelector('input')) return candidate;
    candidate = candidate.parentElement;
  }

  // Last resort: use the input's direct parent
  return input.parentElement;
}

function setupBidInputListeners(
  shippingCost: number | null,
  commissionConfig: CommissionConfig | undefined,
  locale: string,
): void {
  const inputs = findBidInputs();

  inputs.forEach((input) => {
    // Skip if already set up
    if (input.hasAttribute(EXT_ATTR)) return;
    input.setAttribute(EXT_ATTR, 'bid-input-tracked');

    // Find the BidInputRow container to append the total label
    const row = findBidInputRow(input);
    if (!row) return;

    // Create the dynamic total label
    const totalLabel = createExtElement('div', 'bid-input-total');
    applyStyles(totalLabel, {
      fontSize: '11px',
      color: '#888',
      marginTop: '4px',
      minHeight: '16px',
      paddingLeft: '2px',
    });
    row.after(totalLabel);

    // Get the currency symbol from the prefix
    const prefix = row.querySelector('[data-testid="text-field-prefix"]');
    const symbol = prefix?.textContent?.trim() ?? '€';

    const updateTotal = () => {
      const value = parseFloat(input.value);
      if (!input.value || !Number.isFinite(value) || value <= 0) {
        totalLabel.textContent = '';
        return;
      }
      const breakdown = calculateTotal(value, shippingCost, commissionConfig);
      const commissionText = `${getLabel('commission', locale)}: ${formatCurrency(breakdown.commission, symbol, locale)}`;
      const shippingText = breakdown.isPartial
        ? getLabel('excl_shipping', locale)
        : `${getLabel('shipping', locale)}: ${formatCurrency(breakdown.shipping, symbol, locale)}`;
      totalLabel.textContent = `${getLabel('total_price', locale)}: ${formatCurrency(breakdown.total, symbol, locale)} (${commissionText} · ${shippingText})`;
    };

    input.addEventListener('input', updateTotal);
    // Also update on focus in case value was pre-filled
    input.addEventListener('focus', updateTotal);
  });
}

function injectModalBreakdown(dialog: Element): void {
  // Skip if already injected
  if (dialog.querySelector(`[${EXT_ATTR}="modal-breakdown"]`)) return;

  // Find the bid amount in the modal (.u-typography-h3 inside the dialog)
  const bidAmountEl = dialog.querySelector('.u-typography-h3');
  if (!bidAmountEl?.textContent) return;

  const parsed = parseCurrencyAmount(bidAmountEl.textContent);
  if (!parsed) return;

  const shippingCost = findShippingCost();
  const commissionConfig = findCommissionConfig() ?? undefined;
  const breakdown = calculateTotal(parsed.amount, shippingCost, commissionConfig);
  const locale = detectLocale();

  // Build breakdown widget
  const widget = createExtElement('div', 'modal-breakdown');
  applyStyles(widget, {
    ...WIDGET_STYLES,
    margin: '12px 0',
    textAlign: 'center',
  });

  const totalEl = document.createElement('span');
  applyStyles(totalEl, { ...TOTAL_AMOUNT_STYLES, textAlign: 'center' });
  totalEl.textContent = `${getLabel('total_price', locale)}: ${formatCurrency(breakdown.total, parsed.symbol, locale)}`;
  widget.appendChild(totalEl);

  const breakdownEl = document.createElement('span');
  applyStyles(breakdownEl, { ...BREAKDOWN_STYLES, textAlign: 'center' });
  const commissionText = `${getLabel('commission', locale)}: ${formatCurrency(breakdown.commission, parsed.symbol, locale)}`;
  const shippingText = breakdown.isPartial
    ? getLabel('excl_shipping', locale)
    : `${getLabel('shipping', locale)}: ${formatCurrency(breakdown.shipping, parsed.symbol, locale)}`;
  breakdownEl.textContent = `${commissionText} · ${shippingText}`;
  widget.appendChild(breakdownEl);

  // Insert between the bid amount block and the disclaimer
  const container = dialog.querySelector('.tw\\:flex-auto');
  if (!container) return;
  const disclaimer = container.querySelector('.tw\\:text-body-s') ?? container.querySelector('footer');
  if (disclaimer) {
    container.insertBefore(widget, disclaimer);
  }
}

export function setupModalObserver(): MutationObserver {
  const observer = new MutationObserver(() => {
    const dialog = document.querySelector(
      'article[role="dialog"][data-sentry-component="LotBidConfirmation"]',
    );
    if (dialog) {
      injectModalBreakdown(dialog);
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
  return observer;
}

export function updateLotDetailTotal(): void {
  removeLotDetailTotal();
  injectLotDetailTotal();
}
