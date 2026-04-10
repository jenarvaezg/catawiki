import { LOT_DETAIL, queryWithFallback } from './dom-selectors';
import { parseCurrencyAmount } from './currency-parser';
import { parseCommissionFromDOM } from './price-calculator';
import type { CommissionConfig } from './types';
import type { FetchLotHtmlResponse } from '../shared/messages';

export interface LotCostDetails {
  readonly shippingCost: number | null;
  readonly commissionConfig: CommissionConfig | undefined;
}

const FREE_SHIPPING_TEXTS = [
  'free shipping',
  'envío gratuito',
  'kostenloser versand',
  'livraison gratuite',
  'gratis verzending',
] as const;

const SHIPPING_LINE_RE =
  /(shipping to|envío a|versand nach|livraison vers|verzending naar)\s+[^:]+:\s*([€$£]\s*[\d.,]+|[\d.,]+\s*[€$£])/i;

const FETCH_CONCURRENCY = 4;

const lotCostCache = new Map<string, Promise<LotCostDetails>>();
const fetchQueue: Array<() => void> = [];
let activeFetches = 0;

function isFreeShippingText(text: string): boolean {
  const normalized = text.trim().toLowerCase();
  return FREE_SHIPPING_TEXTS.some((value) => normalized.includes(value));
}

function extractShippingCost(root: Document): number | null {
  const shippingEl = queryWithFallback(LOT_DETAIL.SHIPPING_FEE, root);
  const shippingText = shippingEl?.textContent?.trim() ?? '';

  if (shippingText === '') return null;

  const parsed = parseCurrencyAmount(shippingText);
  if (parsed) return parsed.amount;

  return isFreeShippingText(shippingText) ? 0 : null;
}

function extractShippingCostFromText(text: string): number | null {
  if (isFreeShippingText(text)) return 0;

  const match = SHIPPING_LINE_RE.exec(text);
  if (!match) return null;

  const parsed = parseCurrencyAmount(match[2]);
  return parsed?.amount ?? null;
}

function extractCommissionConfig(root: Document): CommissionConfig | undefined {
  const commissionEl = queryWithFallback(LOT_DETAIL.BUYER_PROTECTION, root);
  const commissionText = commissionEl?.textContent?.trim() ?? '';
  return parseCommissionFromDOM(commissionText) ?? undefined;
}

function extractCommissionConfigFromText(text: string): CommissionConfig | undefined {
  return parseCommissionFromDOM(text) ?? undefined;
}

async function withFetchSlot<T>(task: () => Promise<T>): Promise<T> {
  if (activeFetches >= FETCH_CONCURRENCY) {
    await new Promise<void>((resolve) => {
      fetchQueue.push(resolve);
    });
  }

  activeFetches += 1;
  try {
    return await task();
  } finally {
    activeFetches -= 1;
    const next = fetchQueue.shift();
    next?.();
  }
}

export function extractLotCostDetailsFromHtml(html: string): LotCostDetails {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const textContent = doc.body.textContent?.replace(/\s+/g, ' ').trim() ?? '';

  return {
    shippingCost: extractShippingCost(doc) ?? extractShippingCostFromText(textContent),
    commissionConfig: extractCommissionConfig(doc) ?? extractCommissionConfigFromText(textContent),
  };
}

function fetchLotHtmlViaBackground(lotUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const runtime = globalThis.chrome?.runtime;
    if (!runtime?.sendMessage) {
      reject(new Error('Extension messaging unavailable'));
      return;
    }

    runtime.sendMessage({ type: 'fetch-lot-html', lotUrl }, (response: FetchLotHtmlResponse) => {
      const runtimeError = globalThis.chrome?.runtime?.lastError;
      if (runtimeError) {
        reject(new Error(runtimeError.message ?? 'Runtime messaging failed'));
        return;
      }

      if (!response?.ok || typeof response.html !== 'string') {
        reject(new Error(response?.error ?? 'Background fetch failed'));
        return;
      }

      resolve(response.html);
    });
  });
}

function fetchLotHtmlViaIframe(lotUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const iframe = document.createElement('iframe');
    const cleanup = () => {
      window.clearTimeout(timeoutId);
      iframe.removeEventListener('load', onLoad);
      iframe.removeEventListener('error', onError);
      iframe.remove();
    };

    const onLoad = () => {
      try {
        const html = iframe.contentDocument?.documentElement.outerHTML;
        cleanup();

        if (!html) {
          reject(new Error('Iframe loaded without readable HTML'));
          return;
        }

        resolve(html);
      } catch (error) {
        cleanup();
        reject(error instanceof Error ? error : new Error('Iframe HTML read failed'));
      }
    };

    const onError = () => {
      cleanup();
      reject(new Error('Iframe load failed'));
    };

    const timeoutId = window.setTimeout(() => {
      cleanup();
      reject(new Error('Iframe load timed out'));
    }, 15000);

    iframe.style.display = 'none';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.setAttribute('aria-hidden', 'true');
    iframe.addEventListener('load', onLoad);
    iframe.addEventListener('error', onError);
    iframe.src = lotUrl;
    document.body.appendChild(iframe);
  });
}

export function resolveLotCostDetails(
  lotUrl: string,
  extractFn: (html: string) => LotCostDetails = extractLotCostDetailsFromHtml,
): Promise<LotCostDetails> {
  const absoluteUrl = new URL(lotUrl, window.location.href).toString();
  const cached = lotCostCache.get(absoluteUrl);
  if (cached) return cached;

  const request = withFetchSlot(async () => {
    try {
      return extractFn(await fetchLotHtmlViaBackground(absoluteUrl));
    } catch (backgroundError) {
      console.warn('[Catawiki Price Ext] Background fetch failed, falling back to iframe load:', absoluteUrl, backgroundError);
      return extractFn(await fetchLotHtmlViaIframe(absoluteUrl));
    }
  }).catch((error) => {
    lotCostCache.delete(absoluteUrl);
    throw error;
  });

  lotCostCache.set(absoluteUrl, request);
  return request;
}
