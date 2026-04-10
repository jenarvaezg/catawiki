import { LOT_DETAIL, queryWithFallback } from './dom-selectors';
import { detectLocale, getLabel } from './i18n';
import {
  ACTION_BUTTON_STYLES,
  BREAKDOWN_STYLES,
  EXT_ATTR,
  LINK_STYLES,
  SECONDARY_META_STYLES,
  TOTAL_AMOUNT_STYLES,
  TOTAL_LABEL_STYLES,
  WIDGET_STYLES,
  applyStyles,
  createExtElement,
} from './styles';
import type {
  ResolveBullionValueResponse,
  ResolveNumistaMarketResponse,
  SetNumistaApiKeyResponse,
} from '../shared/messages';
import {
  buildLotSearchMetadata,
  type BullionResolutionResult,
  type NumistaMarketResult,
} from '../shared/numista';

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

function findLotTitle(): string {
  const h1 = document.querySelector('h1')?.textContent?.trim();
  if (h1) return h1;

  const ogTitle = document.querySelector('meta[property="og:title"]')?.getAttribute('content')?.trim();
  if (ogTitle) return ogTitle;

  const slug = window.location.pathname.split('/').at(-1) ?? '';
  return slug.replace(/^\d+-/, '').replace(/-/g, ' ').trim() || document.title.trim();
}

function findLotContextText(): string {
  const main = document.querySelector('main');
  const source = main?.textContent ?? document.body.textContent ?? '';
  const normalized = source.replace(/\s+/g, ' ').trim();
  if (normalized === '') return '';

  return normalized
    .split(/\b(?:Otros objetos|Artículos similares|También te pueden gustar|Te puede interesar|You may also like|Similar items|Andere objecten|Autres objets|Andere Artikel)\b/i)[0]
    ?.trim() ?? normalized;
}

function getInsertionAnchor(): Element | null {
  return document.querySelector(`[${EXT_ATTR}="total-price"]`) ?? queryWithFallback(LOT_DETAIL.BID_SECTION);
}

function formatMoney(amount: number, currency: string, locale: string, maxFractionDigits = 2): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      maximumFractionDigits: maxFractionDigits,
      minimumFractionDigits: Math.min(2, maxFractionDigits),
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(Math.min(2, maxFractionDigits))}`;
  }
}

function formatNumber(amount: number, locale: string, maximumFractionDigits = 3): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  }).format(amount);
}

function formatTimestamp(timestamp: string, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(timestamp));
  } catch {
    return timestamp;
  }
}

function createSectionLabel(text: string): HTMLSpanElement {
  const label = document.createElement('span');
  applyStyles(label, TOTAL_LABEL_STYLES);
  label.textContent = text;
  return label;
}

function createBullionWidget(locale: string) {
  const root = createExtElement('div', 'bullion-market');
  applyStyles(root, {
    ...WIDGET_STYLES,
    marginTop: '0',
  });

  root.appendChild(createSectionLabel(getLabel('bullion_value', locale)));

  const amount = document.createElement('span');
  applyStyles(amount, TOTAL_AMOUNT_STYLES);
  amount.textContent = getLabel('bullion_loading', locale);
  root.appendChild(amount);

  const details = document.createElement('span');
  applyStyles(details, BREAKDOWN_STYLES);
  root.appendChild(details);

  const meta = document.createElement('span');
  applyStyles(meta, SECONDARY_META_STYLES);
  root.appendChild(meta);

  const inputRow = document.createElement('div');
  applyStyles(inputRow, {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginTop: '8px',
    flexWrap: 'wrap',
  });
  root.appendChild(inputRow);

  const inputLabel = document.createElement('label');
  applyStyles(inputLabel, {
    fontSize: '11px',
    color: '#666',
    fontWeight: '700',
  });
  inputLabel.textContent = `${getLabel('bullion_input_label', locale)} (g)`;
  inputRow.appendChild(inputLabel);

  const input = document.createElement('input');
  input.type = 'number';
  input.inputMode = 'decimal';
  input.step = '0.001';
  input.min = '0';
  applyStyles(input, {
    width: '92px',
    padding: '6px 8px',
    border: '1px solid #D0D0D0',
    borderRadius: '6px',
    backgroundColor: '#FFFFFF',
    color: '#1A1A1A',
    fontSize: '12px',
  });
  inputRow.appendChild(input);

  const inputHint = document.createElement('span');
  applyStyles(inputHint, {
    fontSize: '11px',
    color: '#888',
  });
  inputRow.appendChild(inputHint);

  return {
    root,
    amount,
    details,
    meta,
    input,
    inputHint,
    currentResult: null as BullionResolutionResult | null,
  };
}

function createNumistaWidget(locale: string) {
  const root = createExtElement('div', 'numista-market');
  applyStyles(root, WIDGET_STYLES);

  root.appendChild(createSectionLabel(getLabel('numista_value', locale)));

  const button = document.createElement('button');
  button.type = 'button';
  applyStyles(button, ACTION_BUTTON_STYLES);
  button.textContent = getLabel('numista_lookup', locale);
  root.appendChild(button);

  const amount = document.createElement('span');
  applyStyles(amount, TOTAL_AMOUNT_STYLES);
  amount.style.display = 'none';
  root.appendChild(amount);

  const details = document.createElement('span');
  applyStyles(details, BREAKDOWN_STYLES);
  details.style.display = 'none';
  root.appendChild(details);

  const meta = document.createElement('span');
  applyStyles(meta, SECONDARY_META_STYLES);
  meta.style.display = 'none';
  root.appendChild(meta);

  const link = document.createElement('a');
  applyStyles(link, LINK_STYLES);
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.style.display = 'none';
  link.textContent = 'Numista';
  root.appendChild(link);

  const alternatives = document.createElement('div');
  applyStyles(alternatives, SECONDARY_META_STYLES);
  alternatives.style.display = 'none';
  root.appendChild(alternatives);

  return { root, button, amount, details, meta, link, alternatives };
}

function getNumistaStatusMessage(result: NumistaMarketResult, locale: string): string {
  switch (result.status) {
    case 'needs-api-key':
      return getLabel('numista_api_key_prompt', locale);
    case 'invalid-api-key':
      return getLabel('numista_invalid_api_key', locale);
    case 'no-match':
      return getLabel('numista_no_match', locale);
    case 'no-issue':
      return getLabel('numista_no_issue', locale);
    case 'no-prices':
      return getLabel('numista_no_prices', locale);
    case 'error':
      return `${getLabel('numista_error', locale)}${result.message ? ` ${result.message}` : ''}`;
    default:
      return '';
  }
}

function renderNumistaResult(
  widget: ReturnType<typeof createNumistaWidget>,
  result: NumistaMarketResult,
  locale: string,
): void {
  widget.button.disabled = false;
  widget.button.textContent = getLabel('numista_refresh', locale);

  if (result.status !== 'ok' || !result.range || !result.currency) {
    widget.amount.style.display = 'none';
    widget.details.style.display = 'block';
    widget.details.textContent = getNumistaStatusMessage(result, locale);
    widget.meta.style.display = 'none';

    if (result.url) {
      widget.link.style.display = 'inline-block';
      widget.link.href = result.url;
      widget.link.textContent = result.title ? result.title : 'Numista';
    } else {
      widget.link.style.display = 'none';
    }

    widget.alternatives.innerHTML = '';
    if (result.alternatives && result.alternatives.length > 0) {
      widget.alternatives.style.display = 'block';
      result.alternatives.forEach((alternative, index) => {
        if (index > 0) {
          widget.alternatives.appendChild(document.createTextNode(' · '));
        }

        if (alternative.url) {
          const alternativeLink = document.createElement('a');
          applyStyles(alternativeLink, LINK_STYLES);
          alternativeLink.href = alternative.url;
          alternativeLink.target = '_blank';
          alternativeLink.rel = 'noopener noreferrer';
          alternativeLink.textContent = alternative.title;
          widget.alternatives.appendChild(alternativeLink);
        } else {
          const alternativeText = document.createElement('span');
          alternativeText.textContent = alternative.title;
          widget.alternatives.appendChild(alternativeText);
        }
      });
    } else {
      widget.alternatives.style.display = 'none';
    }

    return;
  }

  const { min, max } = result.range;
  widget.amount.style.display = 'block';
  widget.amount.textContent = min === max
    ? formatMoney(min, result.currency, locale)
    : `${formatMoney(min, result.currency, locale)} - ${formatMoney(max, result.currency, locale)}`;

  widget.details.style.display = 'block';
  widget.details.textContent = (result.prices ?? [])
    .map((entry) => `${entry.grade.toUpperCase()}: ${formatMoney(entry.price, result.currency!, locale)}`)
    .join(' · ');

  const metaParts = [];
  if (result.typeId) metaParts.push(`Numista #${result.typeId}`);
  if (result.source === 'cache' && result.cachedAt) {
    metaParts.push(`${getLabel('numista_cached', locale)} · ${formatTimestamp(result.cachedAt, locale)}`);
  }
  if (result.issuerName) metaParts.push(result.issuerName);

  widget.meta.style.display = metaParts.length > 0 ? 'block' : 'none';
  widget.meta.textContent = metaParts.join(' · ');

  if (result.url) {
    widget.link.style.display = 'inline-block';
    widget.link.href = result.url;
    widget.link.textContent = result.title ? result.title : 'Numista';
  } else {
    widget.link.style.display = 'none';
  }

  widget.alternatives.style.display = 'none';
  widget.alternatives.innerHTML = '';
}

function renderBullionAmount(
  widget: ReturnType<typeof createBullionWidget>,
  locale: string,
  currency: string,
  spotPricePerGram: number,
  fineWeightGrams: number,
): void {
  const totalValue = fineWeightGrams * spotPricePerGram;
  widget.amount.textContent = formatMoney(totalValue, currency, locale);
  widget.inputHint.textContent = `${formatNumber(fineWeightGrams, locale)} ${getLabel('bullion_fine_weight', locale)}`;
}

function renderBullionResult(
  widget: ReturnType<typeof createBullionWidget>,
  result: BullionResolutionResult,
  locale: string,
): void {
  widget.currentResult = result;

  if (result.status === 'error') {
    widget.amount.textContent = getLabel('bullion_error', locale);
    widget.details.textContent = result.message ? `${getLabel('bullion_error', locale)} ${result.message}` : getLabel('bullion_error', locale);
    widget.meta.textContent = '';
    widget.input.value = '';
    widget.input.placeholder = '';
    widget.inputHint.textContent = '';
    return;
  }

  const estimate = result.estimate;
  const currency = estimate?.currency ?? result.currency ?? 'EUR';
  const spotPricePerGram = estimate?.spotPricePerGram ?? result.spotPricePerGram;

  if (estimate && typeof spotPricePerGram === 'number') {
    renderBullionAmount(widget, locale, currency, spotPricePerGram, estimate.fineWeightGrams);
    widget.input.value = estimate.fineWeightGrams.toFixed(3);

    if (result.derivedFrom === 'title') {
      widget.details.textContent =
        `${estimate.quantity} × ${formatNumber(estimate.unitWeightGrams, locale)} g × ${formatNumber(estimate.purity, locale, 4)} = `
        + `${formatNumber(estimate.fineWeightGrams, locale)} ${getLabel('bullion_fine_weight', locale)}`;
      widget.inputHint.textContent = getLabel('bullion_title_basis', locale);
    } else if (result.derivedFrom === 'numista-cache') {
      widget.details.textContent =
        `${estimate.quantity} × ${formatNumber(estimate.unitWeightGrams, locale)} g × ${formatNumber(estimate.purity, locale, 4)} = `
        + `${formatNumber(estimate.fineWeightGrams, locale)} ${getLabel('bullion_fine_weight', locale)}`;
      widget.inputHint.textContent = getLabel('bullion_numista_cache_basis', locale);
    } else {
      widget.details.textContent = `${formatNumber(estimate.fineWeightGrams, locale)} ${getLabel('bullion_fine_weight', locale)}`;
      widget.inputHint.textContent = '';
    }

    const spotLabel = `${getLabel('bullion_spot', locale)} ${estimate.metal === 'silver' ? 'XAG' : 'XAU'}`;
    const metaParts = [`${spotLabel}: ${formatMoney(estimate.spotPricePerGram, estimate.currency, locale, 4)}/g`];
    if (estimate.updatedAt) metaParts.push(formatTimestamp(estimate.updatedAt, locale));
    if (result.source === 'cache') metaParts.push(getLabel('numista_cached', locale));
    widget.meta.textContent = metaParts.join(' · ');
    return;
  }

  widget.amount.textContent = typeof spotPricePerGram === 'number' ? formatMoney(0, currency, locale) : getLabel('bullion_value', locale);
  widget.details.textContent = getLabel('bullion_needs_input', locale);
  const metaParts = [];
  if (result.metal && typeof spotPricePerGram === 'number') {
    metaParts.push(`${getLabel('bullion_spot', locale)} ${result.metal === 'silver' ? 'XAG' : 'XAU'}: ${formatMoney(spotPricePerGram, currency, locale, 4)}/g`);
  }
  if (result.updatedAt) {
    metaParts.push(formatTimestamp(result.updatedAt, locale));
  }
  if (result.message) {
    metaParts.push(result.message);
  }
  widget.meta.textContent = metaParts.join(' · ');
  widget.input.placeholder = '0.000';
  widget.inputHint.textContent = '';
}

function bindBullionInput(widget: ReturnType<typeof createBullionWidget>, locale: string): void {
  const recalculate = () => {
    const current = widget.currentResult;
    const spotPricePerGram = current?.estimate?.spotPricePerGram ?? current?.spotPricePerGram;
    const currency = current?.estimate?.currency ?? current?.currency;

    if (typeof spotPricePerGram !== 'number' || !currency) return;

    const rawValue = widget.input.value.trim().replace(',', '.');
    const fineWeightGrams = Number.parseFloat(rawValue);
    if (!Number.isFinite(fineWeightGrams) || fineWeightGrams <= 0) {
      if (current.estimate) {
        renderBullionAmount(widget, locale, currency, spotPricePerGram, current.estimate.fineWeightGrams);
        widget.details.textContent =
          `${current.estimate.quantity} × ${formatNumber(current.estimate.unitWeightGrams, locale)} g × ${formatNumber(current.estimate.purity, locale, 4)} = `
          + `${formatNumber(current.estimate.fineWeightGrams, locale)} ${getLabel('bullion_fine_weight', locale)}`;
        widget.inputHint.textContent = current.derivedFrom === 'title'
          ? getLabel('bullion_title_basis', locale)
          : current.derivedFrom === 'numista-cache'
            ? getLabel('bullion_numista_cache_basis', locale)
            : '';
      } else {
        widget.amount.textContent = formatMoney(0, currency, locale);
        widget.details.textContent = getLabel('bullion_needs_input', locale);
        widget.inputHint.textContent = '';
      }
      return;
    }

    renderBullionAmount(widget, locale, currency, spotPricePerGram, fineWeightGrams);
    widget.details.textContent = `${formatNumber(fineWeightGrams, locale)} ${getLabel('bullion_fine_weight', locale)}`;
    widget.inputHint.textContent = getLabel('bullion_input_label', locale);
  };

  widget.input.addEventListener('input', recalculate);
  widget.input.addEventListener('change', recalculate);
}

async function promptAndStoreApiKey(locale: string, invalidKey = false): Promise<boolean> {
  const input = window.prompt(
    getLabel(invalidKey ? 'numista_invalid_api_key' : 'numista_api_key_prompt', locale),
    '',
  );

  const apiKey = input?.trim();
  if (!apiKey) return false;

  const response = await runtimeSendMessage<SetNumistaApiKeyResponse>({
    type: 'set-numista-api-key',
    apiKey,
  });

  if (!response.ok) {
    throw new Error(response.error);
  }

  return true;
}

async function resolveNumistaValue(locale: string, forceRefresh: boolean): Promise<NumistaMarketResult | null> {
  const metadata = buildLotSearchMetadata(window.location.href, findLotTitle(), locale, findLotContextText());
  let response = await runtimeSendMessage<ResolveNumistaMarketResponse>({
    type: 'resolve-numista-market',
    metadata,
    forceRefresh,
  });

  if (!response.ok) {
    throw new Error(response.error);
  }

  if (response.result.status === 'needs-api-key' || response.result.status === 'invalid-api-key') {
    const stored = await promptAndStoreApiKey(locale, response.result.status === 'invalid-api-key');
    if (!stored) return null;

    response = await runtimeSendMessage<ResolveNumistaMarketResponse>({
      type: 'resolve-numista-market',
      metadata,
      forceRefresh: true,
    });

    if (!response.ok) {
      throw new Error(response.error);
    }
  }

  return response.result;
}

async function resolveBullionValue(locale: string, forceRefresh: boolean): Promise<BullionResolutionResult> {
  const metadata = buildLotSearchMetadata(window.location.href, findLotTitle(), locale, findLotContextText());
  const response = await runtimeSendMessage<ResolveBullionValueResponse>({
    type: 'resolve-bullion-value',
    metadata,
    forceRefresh,
  });

  if (!response.ok) {
    throw new Error(response.error);
  }

  return response.result;
}

async function loadBullionWidget(
  widget: ReturnType<typeof createBullionWidget>,
  locale: string,
  forceRefresh = false,
): Promise<void> {
  widget.amount.textContent = getLabel('bullion_loading', locale);
  widget.details.textContent = '';
  widget.meta.textContent = '';

  try {
    const result = await resolveBullionValue(locale, forceRefresh);
    renderBullionResult(widget, result, locale);
  } catch (error) {
    widget.amount.textContent = getLabel('bullion_error', locale);
    widget.details.textContent = `${getLabel('bullion_error', locale)} ${error instanceof Error ? error.message : ''}`.trim();
    widget.meta.textContent = '';
  }
}

export function injectLotDetailMarketWidget(): void {
  if (document.querySelector(`[${EXT_ATTR}="bullion-market"]`) || document.querySelector(`[${EXT_ATTR}="numista-market"]`)) {
    return;
  }

  const locale = detectLocale();
  const anchor = getInsertionAnchor();
  if (!anchor) return;

  const bullionWidget = createBullionWidget(locale);
  bindBullionInput(bullionWidget, locale);
  anchor.after(bullionWidget.root);

  const numistaWidget = createNumistaWidget(locale);
  bullionWidget.root.after(numistaWidget.root);

  void loadBullionWidget(bullionWidget, locale, false);

  numistaWidget.button.addEventListener('click', async () => {
    const forceRefresh = numistaWidget.button.textContent === getLabel('numista_refresh', locale);

    numistaWidget.button.disabled = true;
    numistaWidget.details.style.display = 'block';
    numistaWidget.details.textContent = getLabel('numista_loading', locale);
    numistaWidget.amount.style.display = 'none';
    numistaWidget.meta.style.display = 'none';
    numistaWidget.link.style.display = 'none';
    numistaWidget.alternatives.style.display = 'none';
    numistaWidget.alternatives.innerHTML = '';

    try {
      const result = await resolveNumistaValue(locale, forceRefresh);
      if (!result) {
        numistaWidget.button.disabled = false;
        numistaWidget.details.style.display = 'none';
        return;
      }

      renderNumistaResult(numistaWidget, result, locale);
      if (result.bullion) {
        renderBullionResult(bullionWidget, {
          status: 'ok',
          source: result.bullion.source,
          derivedFrom: result.matchedType ? 'numista-cache' : 'unknown',
          metal: result.bullion.metal,
          estimate: result.bullion,
        }, locale);
      }
    } catch (error) {
      numistaWidget.button.disabled = false;
      numistaWidget.details.style.display = 'block';
      numistaWidget.details.textContent = `${getLabel('numista_error', locale)} ${error instanceof Error ? error.message : ''}`.trim();
    }
  });
}
