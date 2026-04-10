export interface LotSearchMetadata {
  readonly lotUrl: string;
  readonly title: string;
  readonly contextText: string;
  readonly query: string;
  readonly locale: string;
  readonly year: number | null;
  readonly weight: number | null;
  readonly issuerHint: string | null;
  readonly faceValue: FaceValueHint | null;
  readonly metalHint: string | null;
}

export interface NumistaIssuer {
  readonly code?: string;
  readonly name?: string;
}

export interface NumistaTypeSearchResult {
  readonly id: number;
  readonly title: string;
  readonly issuer?: NumistaIssuer;
  readonly min_year?: number;
  readonly max_year?: number;
}

export interface NumistaTypeDetails extends NumistaTypeSearchResult {
  readonly url?: string;
  readonly value?: {
    readonly text?: string;
    readonly numeric_value?: number;
  };
  readonly weight?: number;
  readonly composition?: {
    readonly text?: string;
  };
}

export interface NumistaIssue {
  readonly id: number;
  readonly year?: number | string;
  readonly gregorian_year?: number;
  readonly mint_letter?: string;
  readonly comment?: string;
}

export interface NumistaPrice {
  readonly grade: string;
  readonly price: number;
}

export interface NumistaAlternative {
  readonly id: number;
  readonly title: string;
  readonly url?: string;
  readonly issuerName?: string;
}

export interface FaceValueHint {
  readonly raw: string;
  readonly normalizedUnit: string;
  readonly amount: number;
}

export type BullionMetal = 'silver' | 'gold';

export interface NumistaMatchedTypeSnapshot {
  readonly id: number;
  readonly title: string;
  readonly url?: string;
  readonly issuerName?: string;
  readonly valueText?: string;
  readonly weight?: number;
  readonly compositionText?: string;
}

export interface BullionBasis {
  readonly metal: BullionMetal;
  readonly quantity: number;
  readonly purity: number;
  readonly unitWeightGrams: number;
  readonly grossWeightGrams: number;
  readonly fineWeightGrams: number;
}

export interface BullionEstimate extends BullionBasis {
  readonly currency: string;
  readonly spotPricePerOunce: number;
  readonly spotPricePerGram: number;
  readonly totalValue: number;
  readonly updatedAt?: string;
  readonly source: 'api' | 'cache';
}

export interface BullionResolutionResult {
  readonly status: 'ok' | 'needs-input' | 'error';
  readonly source: 'api' | 'cache';
  readonly derivedFrom: 'title' | 'numista-cache' | 'manual' | 'unknown';
  readonly metal?: BullionMetal;
  readonly currency?: string;
  readonly spotPricePerOunce?: number;
  readonly spotPricePerGram?: number;
  readonly updatedAt?: string;
  readonly estimate?: BullionEstimate | null;
  readonly message?: string;
}

export interface NumistaMarketResult {
  readonly status: 'ok' | 'bullion-only' | 'needs-api-key' | 'invalid-api-key' | 'no-match' | 'no-issue' | 'no-prices' | 'error';
  readonly source: 'api' | 'cache';
  readonly selectionSource?: 'auto' | 'manual' | 'stored';
  readonly searchQuery: string;
  readonly title?: string;
  readonly url?: string;
  readonly typeId?: number;
  readonly issueId?: number;
  readonly issuerName?: string;
  readonly year?: number | null;
  readonly currency?: string | null;
  readonly prices?: readonly NumistaPrice[];
  readonly range?: { readonly min: number; readonly max: number } | null;
  readonly matchedType?: NumistaMatchedTypeSnapshot | null;
  readonly bullion?: BullionEstimate | null;
  readonly alternatives?: readonly NumistaAlternative[];
  readonly cachedAt?: string;
  readonly message?: string;
}

const RESERVE_SUFFIX_RE =
  /\b(?:sin precio de reserva|zonder minimumprijs|zonder reserveprijs|without reserve price|no reserve price|sans prix de réserve)\b/gi;

const TITLE_SUFFIX_RE = /\s+\|\s+catawiki.*$/i;
const NON_ALNUM_RE = /[^\p{L}\p{N}]+/gu;
const DIACRITICS_RE = /\p{Diacritic}+/gu;
const YEAR_RE = /\b(1[5-9]\d{2}|20\d{2}|2100)\b/;
const GRAMS_RE = /\b(\d+(?:[.,]\d+)?)\s*(?:g|gr|gram|grams)\b/i;
const OUNCE_RE = /\b(\d+(?:[.,]\d+)?)\s*oz\b/i;
const LOT_QUANTITY_PATTERNS = [
  /\blot of (\d+)\b/i,
  /\blot consisting of (\d+)\b/i,
  /\blote de (\d+)\b/i,
  /\bset of (\d+)\b/i,
  /\b(\d+)\s*coins?\b/i,
  /\b(\d+)\s*(?:pcs|pieces?)\b/i,
  /\b(\d+)\s*[x×](?=\s*\d|\s*[a-z])/i,
] as const;
const FACE_VALUE_RE =
  /\b(\d+(?:[.,]\d+)?)\s*(dollars?|euros?|yuan|francs?|pounds?|cents?|pence|yen|rupees?|rubles?|reais?|pesos?)\b/i;
const SILVER_RE = /\b(?:silver|plata|silber|argent|zilver|ag)\b/i;
const GOLD_RE = /\b(?:gold|oro|goud|or|au)\b/i;
const PURITY_PATTERNS = [
  /\((0?\.\d{3,4})\)/i,
  /(?:^|[^\d])(0?\.\d{3,4})(?:[^\d]|$)/i,
  /\b(?:ag|au|silver|gold|plata|oro|argent|or)\b[\s.:-]*(9999|999|925|900|835|800)\b/i,
  /\b(9999|999|925|900|835|800)\b[\s-]*(?:fine\s+)?(?:silver|gold|plata|oro|argent|or)\b/i,
  /\b(\d{3,4})\s*\/\s*1000\b/i,
] as const;
const TROY_OUNCE_GRAMS = 31.1034768;

const STOP_WORDS = new Set([
  'ag',
  'au',
  'bu',
  'bullion',
  'coin',
  'coins',
  'fine',
  'g',
  'gold',
  'moneda',
  'monedas',
  'oz',
  '999',
  '9999',
  'plata',
  'proof',
  'reserve',
  'reserva',
  'precio',
  'price',
  'silver',
  'sin',
  'unc',
  'de',
  'la',
  'el',
  'the',
]);

const GRADE_ORDER = ['g', 'vg', 'f', 'vf', 'xf', 'au', 'unc'] as const;

function parseLooseNumber(raw: string): number | null {
  const normalized = raw.trim().replace(',', '.');
  const value = Number.parseFloat(normalized);
  return Number.isFinite(value) ? value : null;
}

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function normalizeUnit(unit: string): string {
  return unit.toLowerCase().replace(/s$/, '');
}

export function cleanLotTitle(title: string): string {
  return title
    .replace(TITLE_SUFFIX_RE, '')
    .replace(RESERVE_SUFFIX_RE, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildEvidenceText(title: string, contextText = ''): string {
  return [cleanLotTitle(title), cleanLotTitle(contextText)].filter((value) => value !== '').join(' ');
}

export function normalizeText(text: string): string {
  return cleanLotTitle(text)
    .normalize('NFD')
    .replace(DIACRITICS_RE, '')
    .toLowerCase()
    .replace(NON_ALNUM_RE, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokeniseSearchText(text: string): string[] {
  return normalizeText(text)
    .split(' ')
    .filter((token) => token !== '' && !STOP_WORDS.has(token));
}

export function buildSearchQuery(title: string): string {
  const tokens = tokeniseSearchText(title);
  return tokens.slice(0, 12).join(' ').trim();
}

export function buildFallbackSearchQuery(title: string): string {
  const tokens = tokeniseSearchText(title).filter((token) => !/^\d+(?:[.,]\d+)?$/.test(token) || token.length === 4);
  return tokens.slice(0, 8).join(' ').trim();
}

function uniqueNonEmpty(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter((value) => value !== ''))];
}

function stripIssuerPrefix(title: string, issuerHint: string | null): string {
  if (!issuerHint) return title;

  const escapedIssuer = issuerHint.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return title.replace(new RegExp(`^${escapedIssuer}[\\s.:-]*`, 'i'), '').trim();
}

function getDescriptorTokens(metadata: LotSearchMetadata): string[] {
  const descriptorSource = stripIssuerPrefix(metadata.title, metadata.issuerHint);
  const yearToken = metadata.year !== null ? String(metadata.year) : null;
  const faceValueAmountToken = metadata.faceValue ? String(metadata.faceValue.amount).replace(/\.0$/, '') : null;
  const faceValueUnitToken = metadata.faceValue?.normalizedUnit ?? null;

  return tokeniseSearchText(descriptorSource).filter((token) => {
    if (yearToken !== null && token === yearToken) return false;
    if (faceValueAmountToken !== null && token === faceValueAmountToken) return false;
    if (faceValueUnitToken !== null && normalizeUnit(token) === faceValueUnitToken) return false;
    if (/^\d+(?:[.,]\d+)?$/.test(token)) return false;
    return true;
  });
}

export function extractYear(text: string): number | null {
  const match = YEAR_RE.exec(text);
  return match ? Number.parseInt(match[1], 10) : null;
}

export function extractWeight(text: string): number | null {
  const grams = GRAMS_RE.exec(text);
  if (grams) return parseLooseNumber(grams[1]);

  const ounces = OUNCE_RE.exec(text);
  if (!ounces) return null;

  const amount = parseLooseNumber(ounces[1]);
  if (amount === null) return null;
  return Math.round(amount * 31.1034768 * 10) / 10;
}

export function extractFaceValue(text: string): FaceValueHint | null {
  const match = FACE_VALUE_RE.exec(normalizeText(text));
  if (!match) return null;

  const amount = parseLooseNumber(match[1]);
  if (amount === null) return null;

  return {
    raw: `${match[1]} ${match[2]}`,
    amount,
    normalizedUnit: normalizeUnit(match[2]),
  };
}

export function extractLotQuantity(text: string): number {
  for (const pattern of LOT_QUANTITY_PATTERNS) {
    const match = pattern.exec(text);
    if (!match) continue;

    const quantity = Number.parseInt(match[1], 10);
    if (Number.isFinite(quantity) && quantity > 0) {
      return quantity;
    }
  }

  return 1;
}

export function extractMetalHint(text: string): string | null {
  if (SILVER_RE.test(text)) return 'silver';
  if (GOLD_RE.test(text)) return 'gold';
  return null;
}

export function extractPurity(text: string): number | null {
  for (const pattern of PURITY_PATTERNS) {
    const match = pattern.exec(text);
    if (!match) continue;

    const rawValue = match[1];
    if (!rawValue) continue;

    const value = parseLooseNumber(rawValue);
    if (value === null) continue;

    const normalized = value > 1 ? value / 1000 : value;
    if (normalized > 0 && normalized <= 1) {
      return normalized;
    }
  }

  return null;
}

export function extractIssuerHint(title: string): string | null {
  const cleaned = cleanLotTitle(title);
  const [prefix] = cleaned.split(/[-.]/, 1);
  const issuer = prefix?.trim();
  return issuer ? issuer : null;
}

export function buildLotSearchMetadata(lotUrl: string, title: string, locale: string, contextText = ''): LotSearchMetadata {
  const cleanedTitle = cleanLotTitle(title);
  const cleanedContextText = cleanLotTitle(contextText);
  const evidenceText = buildEvidenceText(cleanedTitle, cleanedContextText);
  return {
    lotUrl,
    title: cleanedTitle,
    contextText: cleanedContextText,
    query: buildSearchQuery(cleanedTitle),
    locale,
    year: extractYear(cleanedTitle),
    weight: extractWeight(evidenceText),
    issuerHint: extractIssuerHint(cleanedTitle),
    faceValue: extractFaceValue(cleanedTitle),
    metalHint: extractMetalHint(evidenceText),
  };
}

export function buildSearchVariants(metadata: LotSearchMetadata): string[] {
  const faceValueRaw = metadata.faceValue?.raw ?? '';
  const issuerTokens = metadata.issuerHint ? tokeniseSearchText(metadata.issuerHint) : [];
  const descriptorTokens = getDescriptorTokens(metadata);
  const issuerQuery = issuerTokens.join(' ');
  const descriptorsQuery = descriptorTokens.slice(0, 4).join(' ');
  const shortDescriptorsQuery = descriptorTokens.slice(0, 3).join(' ');
  const longDescriptorsQuery = descriptorTokens.slice(0, 5).join(' ');

  return uniqueNonEmpty([
    metadata.query,
    buildFallbackSearchQuery(metadata.title),
    [issuerQuery, faceValueRaw, descriptorsQuery].join(' '),
    [faceValueRaw, descriptorsQuery].join(' '),
    [descriptorsQuery, faceValueRaw].join(' '),
    [issuerQuery, descriptorsQuery].join(' '),
    descriptorsQuery,
    shortDescriptorsQuery,
    longDescriptorsQuery,
  ]);
}

export function buildMarketCacheFingerprint(metadata: LotSearchMetadata): string {
  const issuer = metadata.issuerHint ? normalizeText(metadata.issuerHint) : '';
  const faceValue = metadata.faceValue
    ? `${metadata.faceValue.amount.toFixed(2)}-${metadata.faceValue.normalizedUnit}`
    : '';
  const year = metadata.year !== null ? String(metadata.year) : '';
  const weight = metadata.weight !== null ? metadata.weight.toFixed(1) : '';
  const metal = metadata.metalHint ?? '';
  const descriptors = getDescriptorTokens(metadata).sort().join('_');

  return uniqueNonEmpty([issuer, faceValue, year, weight, metal, descriptors]).join('|');
}

export function buildWeightRange(weight: number | null): string | undefined {
  if (weight === null) return undefined;

  const min = Math.max(0, Math.floor((weight - 0.6) * 10) / 10);
  const max = Math.ceil((weight + 0.6) * 10) / 10;
  return `${min.toFixed(1)}-${max.toFixed(1)}`;
}

export function buildMatchedTypeSnapshot(result: NumistaTypeDetails): NumistaMatchedTypeSnapshot {
  return {
    id: result.id,
    title: result.title,
    url: result.url,
    issuerName: result.issuer?.name,
    valueText: result.value?.text,
    weight: result.weight,
    compositionText: result.composition?.text,
  };
}

export function buildBullionBasis(
  metadata: LotSearchMetadata,
  matchedType: Pick<NumistaMatchedTypeSnapshot, 'weight' | 'compositionText'>,
): BullionBasis | null {
  if (typeof matchedType.weight !== 'number') return null;
  if (!matchedType.compositionText) return null;

  const metal = extractMetalHint(matchedType.compositionText) as BullionMetal | null;
  if (metal !== 'silver' && metal !== 'gold') return null;

  const purity = extractPurity(matchedType.compositionText);
  if (purity === null) return null;

  const quantity = extractLotQuantity(metadata.title);
  const unitWeightGrams = matchedType.weight;
  const grossWeightGrams = roundTo(unitWeightGrams * quantity, 3);
  const fineWeightGrams = roundTo(grossWeightGrams * purity, 3);

  return {
    metal,
    quantity,
    purity,
    unitWeightGrams: roundTo(unitWeightGrams, 3),
    grossWeightGrams,
    fineWeightGrams,
  };
}

export function buildDirectBullionBasis(metadata: LotSearchMetadata): BullionBasis | null {
  if (metadata.weight === null || !metadata.metalHint) return null;

  const metal = metadata.metalHint as BullionMetal | null;
  if (metal !== 'silver' && metal !== 'gold') return null;

  const purity = extractPurity(buildEvidenceText(metadata.title, metadata.contextText));
  if (purity === null) return null;

  const quantity = extractLotQuantity(metadata.title);
  const unitWeightGrams = metadata.weight;
  const grossWeightGrams = roundTo(unitWeightGrams * quantity, 3);
  const fineWeightGrams = roundTo(grossWeightGrams * purity, 3);

  return {
    metal,
    quantity,
    purity,
    unitWeightGrams: roundTo(unitWeightGrams, 3),
    grossWeightGrams,
    fineWeightGrams,
  };
}

export function estimateBullionValue(
  basis: BullionBasis,
  quote: {
    readonly currency: string;
    readonly pricePerOunce: number;
    readonly updatedAt?: string;
    readonly source: 'api' | 'cache';
  },
): BullionEstimate {
  const spotPricePerGram = quote.pricePerOunce / TROY_OUNCE_GRAMS;
  return {
    ...basis,
    currency: quote.currency,
    spotPricePerOunce: roundTo(quote.pricePerOunce, 4),
    spotPricePerGram: roundTo(spotPricePerGram, 4),
    totalValue: roundTo(basis.fineWeightGrams * spotPricePerGram, 2),
    updatedAt: quote.updatedAt,
    source: quote.source,
  };
}

function scoreFaceValue(candidateText: string, metadata: LotSearchMetadata): number {
  if (!metadata.faceValue) return 0;

  const candidateFaceValue = extractFaceValue(candidateText);
  if (!candidateFaceValue) return 0;

  if (candidateFaceValue.normalizedUnit !== metadata.faceValue.normalizedUnit) {
    return 0;
  }

  return candidateFaceValue.amount === metadata.faceValue.amount ? 24 : -28;
}

export function scoreTypeMatch(result: NumistaTypeSearchResult, metadata: LotSearchMetadata): number {
  const queryTokens = tokeniseSearchText(metadata.query || metadata.title);
  const titleTokens = new Set(tokeniseSearchText(result.title));

  let score = 0;

  queryTokens.forEach((token) => {
    if (titleTokens.has(token)) {
      score += /^\d+$/.test(token) ? 3 : 2;
    }
  });

  const normalizedTitle = normalizeText(result.title);
  const normalizedQuery = normalizeText(metadata.query || metadata.title);
  if (normalizedQuery !== '' && normalizedTitle.includes(normalizedQuery)) {
    score += 8;
  }

  score += scoreFaceValue(result.title, metadata);

  if (metadata.issuerHint) {
    const issuerName = normalizeText(result.issuer?.name ?? '');
    const issuerCode = normalizeText(result.issuer?.code ?? '');
    const issuerHint = normalizeText(metadata.issuerHint);
    if (issuerName.includes(issuerHint) || issuerCode.includes(issuerHint)) {
      score += 6;
    }
  }

  if (metadata.year !== null) {
    const minYear = result.min_year ?? metadata.year;
    const maxYear = result.max_year ?? metadata.year;
    if (metadata.year >= minYear && metadata.year <= maxYear) {
      score += 6;
    } else {
      score -= 8;
    }
  }

  return score;
}

function scoreWeight(candidateWeight: number | undefined, metadata: LotSearchMetadata): number {
  if (metadata.weight === null || typeof candidateWeight !== 'number') return 0;

  const delta = Math.abs(candidateWeight - metadata.weight);
  if (delta <= 0.3) return 10;
  if (delta <= 1) return 6;
  if (delta <= 3) return 2;
  if (delta >= 8) return -10;
  if (delta >= 4) return -6;
  return 0;
}

function scoreMetal(candidateComposition: string | undefined, metadata: LotSearchMetadata): number {
  if (!metadata.metalHint || !candidateComposition) return 0;

  const candidateMetal = extractMetalHint(candidateComposition);
  if (!candidateMetal) return 0;
  return candidateMetal === metadata.metalHint ? 6 : -8;
}

export function scoreDetailedTypeMatch(result: NumistaTypeDetails, metadata: LotSearchMetadata): number {
  let score = scoreTypeMatch(result, metadata);

  const detailedValueText = [result.title, result.value?.text].filter(Boolean).join(' ');
  score += scoreFaceValue(detailedValueText, metadata);
  score += scoreWeight(result.weight, metadata);
  score += scoreMetal(result.composition?.text, metadata);

  return score;
}

export function pickBestType(
  results: readonly NumistaTypeSearchResult[],
  metadata: LotSearchMetadata,
): NumistaTypeSearchResult | null {
  const scored = results
    .map((result) => ({ result, score: scoreTypeMatch(result, metadata) }))
    .sort((left, right) => right.score - left.score);

  if (scored.length === 0) return null;
  if (scored[0].score <= 0) return null;
  return scored[0].result;
}

export function pickBestDetailedType(
  results: readonly NumistaTypeDetails[],
  metadata: LotSearchMetadata,
): NumistaTypeDetails | null {
  const scored = results
    .map((result) => ({ result, score: scoreDetailedTypeMatch(result, metadata) }))
    .sort((left, right) => right.score - left.score);

  if (scored.length === 0) return null;
  if (scored[0].score <= 0) return null;
  return scored[0].result;
}

function parseIssueYear(issue: NumistaIssue): number | null {
  if (typeof issue.gregorian_year === 'number') return issue.gregorian_year;
  if (typeof issue.year === 'number') return issue.year;
  if (typeof issue.year === 'string') return extractYear(issue.year);
  return null;
}

export function pickIssueForYear(issues: readonly NumistaIssue[], year: number | null): NumistaIssue | null {
  if (issues.length === 0) return null;

  if (year !== null) {
    const exact = issues.find((issue) => parseIssueYear(issue) === year);
    if (exact) return exact;
  }

  return issues.length === 1 ? issues[0] : null;
}

export function summarizePrices(prices: readonly NumistaPrice[]) {
  const sorted = [...prices]
    .filter((entry) => Number.isFinite(entry.price))
    .sort((left, right) => {
      const leftIndex = GRADE_ORDER.indexOf(left.grade.toLowerCase() as (typeof GRADE_ORDER)[number]);
      const rightIndex = GRADE_ORDER.indexOf(right.grade.toLowerCase() as (typeof GRADE_ORDER)[number]);
      return leftIndex - rightIndex;
    });

  if (sorted.length === 0) {
    return { prices: [] as NumistaPrice[], range: null };
  }

  const amounts = sorted.map((entry) => entry.price);
  return {
    prices: sorted,
    range: {
      min: Math.min(...amounts),
      max: Math.max(...amounts),
    },
  };
}
