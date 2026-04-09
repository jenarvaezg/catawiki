import type { PriceBreakdown, CommissionConfig } from './types';
import { parseCurrencyAmount } from './currency-parser';

const DEFAULT_COMMISSION: CommissionConfig = { rate: 0.09, fixedFee: 3 };

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function calculateCommission(
  bidAmount: number,
  config: CommissionConfig = DEFAULT_COMMISSION,
): number {
  return round2(bidAmount * config.rate + config.fixedFee);
}

export function calculateTotal(
  bidAmount: number,
  shippingCost: number | null,
  config: CommissionConfig = DEFAULT_COMMISSION,
): PriceBreakdown {
  const commission = calculateCommission(bidAmount, config);
  if (shippingCost !== null) {
    const shipping = round2(shippingCost);
    return { total: round2(bidAmount + commission + shipping), commission, shipping, isPartial: false as const };
  }
  return { total: round2(bidAmount + commission), commission, shipping: null, isPartial: true as const };
}

export function formatCurrency(
  amount: number,
  symbol: string,
  locale: string,
): string {
  const rounded = round2(amount);
  const isWholeNumber = rounded === Math.floor(rounded);
  const formatted = isWholeNumber
    ? formatInteger(Math.floor(rounded), locale)
    : formatDecimal(rounded, locale);

  // Spanish cards use post-positioned symbol, but detail pages use pre-positioned.
  // Default to pre-positioned (matches lot detail pages where we inject).
  return `${symbol}\u00a0${formatted}`;
}

const DOT_THOUSANDS_LOCALES = new Set(['es', 'de', 'nl', 'fr', 'it', 'pt']);

function formatInteger(n: number, locale: string): string {
  const sep = DOT_THOUSANDS_LOCALES.has(locale) ? '.' : ',';
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, sep);
}

function formatDecimal(n: number, locale: string): string {
  const [intPart, decPart] = n.toFixed(2).split('.');
  const intFormatted = formatInteger(parseInt(intPart, 10), locale);
  const decSep = DOT_THOUSANDS_LOCALES.has(locale) ? ',' : '.';
  return `${intFormatted}${decSep}${decPart}`;
}

// Parse commission from DOM text like "Buyer Protection fee: 9% + € 3"
// or "Tarifa de la Protección del Comprador: 9% + € 3"
const COMMISSION_RE = /(\d+)%\s*\+\s*[€$£]?\s*([\d.,]+)\s*[€$£]?/;

const MAX_REASONABLE_RATE = 0.5;
const MAX_REASONABLE_FEE = 100;

export function parseCommissionFromDOM(text: string): CommissionConfig | null {
  const match = COMMISSION_RE.exec(text);
  if (!match) return null;

  const rate = parseInt(match[1], 10) / 100;
  const feeParsed = parseCurrencyAmount(match[2]) ?? parseCurrencyAmount(`€${match[2]}`);
  const fixedFee = feeParsed?.amount ?? parseFloat(match[2].replace(',', '.'));

  if (!Number.isFinite(rate) || !Number.isFinite(fixedFee)) return null;
  if (rate > MAX_REASONABLE_RATE || fixedFee > MAX_REASONABLE_FEE) return null;
  return { rate, fixedFee };
}
