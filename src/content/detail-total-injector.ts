import type { Platform } from '../platforms/platform';
import { parseCurrencyAmount } from './currency-parser';
import { calculateTotal, formatCurrency } from './price-calculator';
import { getLabel } from './i18n';
import { resolveLotCostDetails } from './lot-cost-resolver';
import {
  EXT_ATTR,
  WIDGET_STYLES,
  TOTAL_LABEL_STYLES,
  TOTAL_AMOUNT_STYLES,
  BREAKDOWN_STYLES,
  applyStyles,
  createExtElement,
} from './styles';

/**
 * Generic detail page total widget for non-auction platforms (Wallapop, Vinted).
 * Shows: price + buyer fee + shipping = total with breakdown.
 */
export function injectDetailTotal(platform: Platform): void {
  if (document.querySelector(`[${EXT_ATTR}="detail-total"]`)) return;

  const locale = platform.detectLocale();
  const anchor = platform.getDetailInjectionAnchor();
  if (!anchor) return;

  // Find price on the detail page
  const priceEl = anchor.closest('[class*="price"], [class*="Price"]') ?? anchor;
  const priceText = priceEl?.textContent?.trim() ?? '';
  const parsed = parseCurrencyAmount(priceText);
  if (!parsed) return;

  const price = parsed.amount;
  const symbol = parsed.symbol;

  // Get commission for this price
  const commissionConfig = platform.getCommissionForPrice?.(price) ?? platform.defaultCommissionConfig;

  // Build widget (initially with commission only, shipping TBD)
  const widget = createExtElement('div', 'detail-total');
  applyStyles(widget, WIDGET_STYLES);

  const label = document.createElement('span');
  applyStyles(label, TOTAL_LABEL_STYLES);
  label.textContent = getLabel('total_price', locale);
  widget.appendChild(label);

  const totalEl = document.createElement('span');
  applyStyles(totalEl, TOTAL_AMOUNT_STYLES);
  totalEl.textContent = getLabel('calculating', locale);
  widget.appendChild(totalEl);

  const breakdownEl = document.createElement('span');
  applyStyles(breakdownEl, BREAKDOWN_STYLES);
  widget.appendChild(breakdownEl);

  anchor.after(widget);

  // Resolve shipping from the current page HTML
  void resolveAndPopulate(platform, price, symbol, commissionConfig, totalEl, breakdownEl, locale);
}

async function resolveAndPopulate(
  platform: Platform,
  price: number,
  symbol: string,
  initialCommission: { readonly rate: number; readonly fixedFee: number },
  totalEl: HTMLElement,
  breakdownEl: HTMLElement,
  locale: string,
): Promise<void> {
  let shippingCost: number | null = null;
  let commissionConfig = initialCommission;

  // Try to extract cost from the current page's HTML
  try {
    const html = document.documentElement.outerHTML;
    const details = platform.extractCostFromHtml(html);
    shippingCost = details.shippingCost;
    if (details.commissionConfig) {
      commissionConfig = details.commissionConfig;
    }
  } catch {
    // Continue with what we have
  }

  // Also try fetching via background (gets a clean copy)
  const productUrl = platform.getCanonicalProductUrl(window.location.href);
  if (productUrl) {
    try {
      const extractFn = (html: string) => platform.extractCostFromHtml(html);
      const fetched = await resolveLotCostDetails(productUrl, extractFn);
      shippingCost = fetched.shippingCost ?? shippingCost;
      if (fetched.commissionConfig) {
        commissionConfig = fetched.commissionConfig;
      }
    } catch {
      // Use what we extracted from the live page
    }
  }

  const breakdown = calculateTotal(price, shippingCost, commissionConfig);

  totalEl.textContent = formatCurrency(breakdown.total, symbol, locale);

  const parts: string[] = [];

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

  breakdownEl.textContent = parts.join(' · ');
}
