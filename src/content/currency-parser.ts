import type { ParsedCurrency } from './types';

const CURRENCY_SYMBOLS = '€$£';

// Matches: € 3,000 | €320 | € 3.000 | $1,234.56
const PRE_SYMBOL_RE = new RegExp(`([${CURRENCY_SYMBOLS}])\\s*([\\d.,]+)`);
// Matches: 380 € | 71€ | 3.000 €
const POST_SYMBOL_RE = new RegExp(`([\\d.,]+)\\s*([${CURRENCY_SYMBOLS}])`);

function parseLocalizedNumber(raw: string): number | null {
  const cleaned = raw.trim();
  if (cleaned === '') return null;

  const lastDot = cleaned.lastIndexOf('.');
  const lastComma = cleaned.lastIndexOf(',');

  let normalized: string;

  if (lastDot > -1 && lastComma > -1) {
    // Both present: the LAST separator is the decimal
    if (lastComma > lastDot) {
      // e.g. 1.234,56 → European
      normalized = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
      // e.g. 1,234.56 → US
      normalized = cleaned.replace(/,/g, '');
    }
  } else if (lastComma > -1) {
    const afterComma = cleaned.slice(lastComma + 1);
    if (afterComma.length === 3 && !afterComma.includes('.')) {
      // e.g. 3,000 → thousands separator
      normalized = cleaned.replace(/,/g, '');
    } else {
      // e.g. 3,50 → decimal
      normalized = cleaned.replace(',', '.');
    }
  } else if (lastDot > -1) {
    const afterDot = cleaned.slice(lastDot + 1);
    if (afterDot.length === 3) {
      // e.g. 3.000 → thousands separator
      normalized = cleaned.replace(/\./g, '');
    } else {
      // e.g. 3.50 → decimal
      normalized = cleaned;
    }
  } else {
    // No separators: plain integer
    normalized = cleaned;
  }

  const result = parseFloat(normalized);
  return Number.isFinite(result) ? result : null;
}

export function parseCurrencyAmount(text: string): ParsedCurrency | null {
  // Try pre-positioned symbol first (€ 380)
  const preMatch = PRE_SYMBOL_RE.exec(text);
  if (preMatch) {
    const amount = parseLocalizedNumber(preMatch[2]);
    if (amount !== null) {
      return { symbol: preMatch[1], amount };
    }
  }

  // Try post-positioned symbol (380 €)
  const postMatch = POST_SYMBOL_RE.exec(text);
  if (postMatch) {
    const amount = parseLocalizedNumber(postMatch[1]);
    if (amount !== null) {
      return { symbol: postMatch[2], amount };
    }
  }

  return null;
}
