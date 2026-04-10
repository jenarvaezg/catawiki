import {
  isFetchLotHtmlRequest,
  isResolveBullionValueRequest,
  isResolveNumistaMarketRequest,
  isSetNumistaApiKeyRequest,
  type FetchLotHtmlResponse,
  type ResolveBullionValueResponse,
  type ResolveNumistaMarketResponse,
  type SetNumistaApiKeyResponse,
} from './shared/messages';
import {
  buildBullionBasis,
  buildDirectBullionBasis,
  buildMatchedTypeSnapshot,
  buildMarketCacheFingerprint,
  buildFallbackSearchQuery,
  buildSearchVariants,
  buildWeightRange,
  estimateBullionValue,
  pickBestDetailedType,
  pickIssueForYear,
  scoreDetailedTypeMatch,
  scoreTypeMatch,
  summarizePrices,
  type BullionMetal,
  type BullionResolutionResult,
  type NumistaAlternative,
  type LotSearchMetadata,
  type NumistaIssue,
  type NumistaMarketResult,
  type NumistaPrice,
  type NumistaTypeDetails,
  type NumistaTypeSearchResult,
} from './shared/numista';

const NUMISTA_API_BASE_URL = 'https://api.numista.com/v3';
const BULLION_SPOT_API_BASE_URL = 'https://api.gold-api.com/price';
const NUMISTA_API_KEY_STORAGE_KEY = 'numista.apiKey';
const NUMISTA_CACHE_PREFIX = 'numista.market.v7:';
const BULLION_SPOT_CACHE_PREFIX = 'bullion.spot.v1:';
const SUCCESS_CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7;
const EMPTY_CACHE_TTL_MS = 1000 * 60 * 60 * 24;
const BULLION_SPOT_TTL_MS = 1000 * 60 * 15;
const MAX_SEARCH_QUERIES = 4;
const MAX_DETAIL_FETCHES = 3;
const EARLY_STOP_SCORE = 18;
const EARLY_STOP_CANDIDATES = 3;

interface NumistaSearchResponse {
  readonly types?: readonly NumistaTypeSearchResult[];
}

interface NumistaPriceResponse {
  readonly currency?: string;
  readonly prices?: readonly NumistaPrice[];
}

interface BullionSpotResponse {
  readonly currency?: string;
  readonly price?: number;
  readonly updatedAt?: string;
}

interface ResolvedTypeMatch {
  readonly best: NumistaTypeDetails | null;
  readonly alternatives: readonly NumistaAlternative[];
}

interface CachedNumistaMarketResult {
  readonly expiresAt: number;
  readonly result: NumistaMarketResult;
}

interface CachedBullionSpotQuote {
  readonly expiresAt: number;
  readonly currency: string;
  readonly pricePerOunce: number;
  readonly updatedAt?: string;
}

class NumistaApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

class NumistaAuthError extends NumistaApiError {}

function getStorageArea() {
  return globalThis.chrome?.storage?.local;
}

function cacheKeyForLot(lotUrl: string): string {
  return `${NUMISTA_CACHE_PREFIX}lot:${lotUrl}`;
}

function cacheKeyForFingerprint(metadata: LotSearchMetadata): string {
  return `${NUMISTA_CACHE_PREFIX}fp:${buildMarketCacheFingerprint(metadata)}`;
}

function cacheKeyForBullionSpot(metal: BullionMetal, currency: string): string {
  return `${BULLION_SPOT_CACHE_PREFIX}${metal}:${currency}`;
}

function supportedNumistaLanguage(locale: string): string {
  return ['en', 'es', 'fr'].includes(locale) ? locale : 'en';
}

function bullionSymbolForMetal(metal: BullionMetal): 'XAG' | 'XAU' {
  return metal === 'silver' ? 'XAG' : 'XAU';
}

function cacheTtlForStatus(status: NumistaMarketResult['status']): number {
  return status === 'ok' ? SUCCESS_CACHE_TTL_MS : EMPTY_CACHE_TTL_MS;
}

function isCacheableResult(status: NumistaMarketResult['status']): boolean {
  return status === 'ok' || status === 'bullion-only' || status === 'no-match' || status === 'no-issue' || status === 'no-prices';
}

function getStorageValue<T>(key: string): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const storage = getStorageArea();
    if (!storage?.get) {
      resolve(undefined);
      return;
    }

    storage.get(key, (items) => {
      const runtimeError = globalThis.chrome?.runtime?.lastError;
      if (runtimeError) {
        reject(new Error(runtimeError.message ?? 'Storage read failed'));
        return;
      }

      resolve(items?.[key] as T | undefined);
    });
  });
}

function setStorageValues(values: Record<string, unknown>): Promise<void> {
  return new Promise((resolve, reject) => {
    const storage = getStorageArea();
    if (!storage?.set) {
      resolve();
      return;
    }

    storage.set(values, () => {
      const runtimeError = globalThis.chrome?.runtime?.lastError;
      if (runtimeError) {
        reject(new Error(runtimeError.message ?? 'Storage write failed'));
        return;
      }

      resolve();
    });
  });
}

function removeStorageValue(key: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const storage = getStorageArea();
    if (!storage?.remove) {
      resolve();
      return;
    }

    storage.remove(key, () => {
      const runtimeError = globalThis.chrome?.runtime?.lastError;
      if (runtimeError) {
        reject(new Error(runtimeError.message ?? 'Storage delete failed'));
        return;
      }

      resolve();
    });
  });
}

async function fetchLotHtml(lotUrl: string): Promise<string> {
  const response = await fetch(lotUrl, {
    credentials: 'include',
    headers: {
      Accept: 'text/html',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch lot detail: ${response.status}`);
  }

  return await response.text();
}

async function fetchNumistaJson<T>(
  path: string,
  apiKey: string,
  searchParams: Record<string, string | undefined>,
): Promise<T> {
  const url = new URL(`${NUMISTA_API_BASE_URL}${path}`);
  Object.entries(searchParams).forEach(([key, value]) => {
    if (value) {
      url.searchParams.set(key, value);
    }
  });

  const response = await fetch(url.toString(), {
    headers: {
      Accept: 'application/json',
      'Numista-API-Key': apiKey,
    },
  });

  if (response.status === 401) {
    throw new NumistaAuthError('Invalid Numista API key', 401);
  }

  if (!response.ok) {
    let errorMessage = `Numista API request failed: ${response.status}`;
    try {
      const errorBody = await response.json() as { error?: { message?: string }; message?: string };
      errorMessage = errorBody.error?.message ?? errorBody.message ?? errorMessage;
    } catch {
      // Ignore JSON parsing failures and keep the fallback message.
    }
    throw new NumistaApiError(errorMessage, response.status);
  }

  return await response.json() as T;
}

async function fetchBullionSpotFromApi(
  metal: BullionMetal,
  currency: string,
): Promise<CachedBullionSpotQuote> {
  const response = await fetch(`${BULLION_SPOT_API_BASE_URL}/${bullionSymbolForMetal(metal)}/${currency}`, {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Bullion spot API failed: ${response.status}`);
  }

  const body = await response.json() as BullionSpotResponse;
  if (!body.currency || typeof body.price !== 'number' || !Number.isFinite(body.price)) {
    throw new Error('Bullion spot API returned an invalid payload');
  }

  return {
    expiresAt: Date.now() + BULLION_SPOT_TTL_MS,
    currency: body.currency,
    pricePerOunce: body.price,
    updatedAt: body.updatedAt,
  };
}

async function resolveBullionSpot(
  metal: BullionMetal,
  currency: string,
  forceRefresh = false,
): Promise<{
  readonly currency: string;
  readonly pricePerOunce: number;
  readonly updatedAt?: string;
  readonly source: 'api' | 'cache';
}> {
  const cacheKey = cacheKeyForBullionSpot(metal, currency);

  if (!forceRefresh) {
    const cached = await getStorageValue<CachedBullionSpotQuote>(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return {
        currency: cached.currency,
        pricePerOunce: cached.pricePerOunce,
        updatedAt: cached.updatedAt,
        source: 'cache',
      };
    }
  }

  const fresh = await fetchBullionSpotFromApi(metal, currency);
  await setStorageValues({ [cacheKey]: fresh });

  return {
    currency: fresh.currency,
    pricePerOunce: fresh.pricePerOunce,
    updatedAt: fresh.updatedAt,
    source: 'api',
  };
}

async function searchTypes(
  apiKey: string,
  metadata: LotSearchMetadata,
  query: string,
  options: {
    readonly includeYear: boolean;
    readonly includeWeight: boolean;
    readonly includeIssuer: boolean;
  },
): Promise<readonly NumistaTypeSearchResult[]> {
  if (query.trim() === '') return [];

  const year = options.includeYear && metadata.year !== null ? String(metadata.year) : undefined;
  const weight = options.includeWeight ? buildWeightRange(metadata.weight) : undefined;
  const issuer = options.includeIssuer
    ? metadata.issuerHint?.trim().toLowerCase().replace(/\s+/g, '-')
    : undefined;

  try {
    const response = await fetchNumistaJson<NumistaSearchResponse>('/types', apiKey, {
      q: query,
      count: '10',
      lang: supportedNumistaLanguage(metadata.locale),
      year,
      weight,
      issuer,
    });

    return response.types ?? [];
  } catch (error) {
    if (error instanceof NumistaApiError && error.status === 400) {
      console.warn('[Catawiki Price Ext] Ignoring invalid Numista search combination:', {
        query,
        year,
        weight,
        issuer,
      });
      return [];
    }

    throw error;
  }
}

async function resolveMatchingType(
  apiKey: string,
  metadata: LotSearchMetadata,
): Promise<ResolvedTypeMatch> {
  const collectedCandidates = new Map<number, NumistaTypeSearchResult>();
  const queries = buildSearchVariants(metadata).slice(0, MAX_SEARCH_QUERIES);
  const searchPlans = [
    { includeYear: true, includeWeight: true, includeIssuer: true },
    { includeYear: true, includeWeight: false, includeIssuer: true },
    { includeYear: true, includeWeight: false, includeIssuer: false },
    { includeYear: false, includeWeight: false, includeIssuer: false },
  ] as const;

  let shouldStopEarly = false;

  for (const query of queries) {
    for (const plan of searchPlans) {
      const candidates = await searchTypes(apiKey, metadata, query, plan);
      candidates.forEach((candidate) => {
        collectedCandidates.set(candidate.id, candidate);
      });

      const ranked = [...collectedCandidates.values()]
        .map((result) => ({ result, score: scoreTypeMatch(result, metadata) }))
        .sort((left, right) => right.score - left.score);

      if (ranked.length > 0 && (ranked[0].score >= EARLY_STOP_SCORE || ranked.length >= EARLY_STOP_CANDIDATES)) {
        shouldStopEarly = true;
        break;
      }
    }

    if (shouldStopEarly) break;
  }

  const rankedCandidates = [...collectedCandidates.values()]
    .map((result) => ({ result, score: scoreTypeMatch(result, metadata) }))
    .sort((left, right) => {
      return right.score - left.score;
    });

  const shortlisted = rankedCandidates
    .map(({ result }) => result)
    .filter((candidate) => scoreTypeMatch(candidate, metadata) > 0)
    .slice(0, MAX_DETAIL_FETCHES);

  if (shortlisted.length === 0) {
    return {
      best: null,
      alternatives: [],
    };
  }

  const lang = supportedNumistaLanguage(metadata.locale);
  const detailedCandidates = await Promise.all(
    shortlisted.map((candidate) => fetchNumistaJson<NumistaTypeDetails>(`/types/${candidate.id}`, apiKey, { lang })),
  );

  const rankedDetailedCandidates = detailedCandidates
    .map((candidate) => ({ candidate, score: scoreDetailedTypeMatch(candidate, metadata) }))
    .sort((left, right) => right.score - left.score);

  return {
    best: pickBestDetailedType(detailedCandidates, metadata),
    alternatives: rankedDetailedCandidates.slice(0, 3).map(({ candidate }) => ({
      id: candidate.id,
      title: candidate.title,
      url: candidate.url,
      issuerName: candidate.issuer?.name,
    })),
  };
}

async function resolveNumistaMarketFromApi(
  apiKey: string,
  metadata: LotSearchMetadata,
): Promise<NumistaMarketResult> {
  const searchQuery = metadata.query || buildFallbackSearchQuery(metadata.title) || metadata.title;
  const matched = await resolveMatchingType(apiKey, metadata);
  const matchedType = matched.best;

  if (!matchedType) {
    return {
      status: 'no-match',
      source: 'api',
      searchQuery,
      year: metadata.year,
      alternatives: matched.alternatives,
    };
  }

  const matchedTypeSnapshot = buildMatchedTypeSnapshot(matchedType);
  const lang = supportedNumistaLanguage(metadata.locale);
  const issues = await fetchNumistaJson<readonly NumistaIssue[]>(`/types/${matchedType.id}/issues`, apiKey, { lang });
  const issue = pickIssueForYear(issues, metadata.year);

  if (!issue) {
    return {
      status: 'no-issue',
      source: 'api',
      searchQuery,
      title: matchedType.title,
      url: matchedType.url,
      typeId: matchedType.id,
      issuerName: matchedType.issuer?.name,
      year: metadata.year,
      matchedType: matchedTypeSnapshot,
      alternatives: matched.alternatives,
    };
  }

  const prices = await fetchNumistaJson<NumistaPriceResponse>(
    `/types/${matchedType.id}/issues/${issue.id}/prices`,
    apiKey,
    {
      currency: 'EUR',
      lang,
    },
  );

  const summary = summarizePrices(prices.prices ?? []);
  if (summary.prices.length === 0 || !prices.currency) {
    return {
      status: 'no-prices',
      source: 'api',
      searchQuery,
      title: matchedType.title,
      url: matchedType.url,
      typeId: matchedType.id,
      issueId: issue.id,
      issuerName: matchedType.issuer?.name,
      year: metadata.year,
      matchedType: matchedTypeSnapshot,
      alternatives: matched.alternatives,
    };
  }

  return {
    status: 'ok',
    source: 'api',
    searchQuery,
    title: matchedType.title,
    url: matchedType.url,
    typeId: matchedType.id,
    issueId: issue.id,
    issuerName: matchedType.issuer?.name,
    year: metadata.year,
    currency: prices.currency,
    prices: summary.prices,
    range: summary.range,
    matchedType: matchedTypeSnapshot,
    alternatives: matched.alternatives,
  };
}

async function readCachedEntry(cacheKey: string): Promise<CachedNumistaMarketResult | null> {
  const entry = await getStorageValue<CachedNumistaMarketResult>(cacheKey);
  if (!entry) return null;

  if (entry.expiresAt <= Date.now()) {
    await removeStorageValue(cacheKey);
    return null;
  }

  return entry;
}

async function loadCachedNumistaResult(metadata: LotSearchMetadata): Promise<NumistaMarketResult | null> {
  const lotKey = cacheKeyForLot(metadata.lotUrl);
  const lotEntry = await readCachedEntry(lotKey);
  if (lotEntry) {
    return {
      ...lotEntry.result,
      source: 'cache',
    };
  }

  const fingerprintKey = cacheKeyForFingerprint(metadata);
  if (fingerprintKey === lotKey) return null;

  const fingerprintEntry = await readCachedEntry(fingerprintKey);
  if (!fingerprintEntry) return null;

  await setStorageValues({ [lotKey]: fingerprintEntry });
  return {
    ...fingerprintEntry.result,
    source: 'cache',
  };
}

async function saveCachedNumistaResult(metadata: LotSearchMetadata, result: NumistaMarketResult): Promise<void> {
  if (!isCacheableResult(result.status)) return;

  const cachedAt = new Date().toISOString();
  const entry = {
    expiresAt: Date.now() + cacheTtlForStatus(result.status),
    result: {
      ...result,
      source: 'api',
      cachedAt,
    },
  } satisfies CachedNumistaMarketResult;

  await setStorageValues({
    [cacheKeyForLot(metadata.lotUrl)]: entry,
    [cacheKeyForFingerprint(metadata)]: entry,
  });
}

async function enrichResultWithBullion(
  metadata: LotSearchMetadata,
  result: NumistaMarketResult,
  forceRefresh = false,
): Promise<NumistaMarketResult> {
  const basis = buildDirectBullionBasis(metadata)
    ?? (result.matchedType ? buildBullionBasis(metadata, result.matchedType) : null);

  if (!basis) {
    return {
      ...result,
      bullion: null,
    };
  }

  try {
    const spot = await resolveBullionSpot(basis.metal, 'EUR', forceRefresh);
    return {
      ...result,
      bullion: estimateBullionValue(basis, spot),
    };
  } catch (error) {
    console.warn('[Catawiki Price Ext] Failed to resolve bullion spot:', error);
    return {
      ...result,
      bullion: null,
    };
  }
}

async function resolveBullionValue(
  metadata: LotSearchMetadata,
  forceRefresh = false,
): Promise<BullionResolutionResult> {
  const directBasis = buildDirectBullionBasis(metadata);
  let basis = directBasis;
  let derivedFrom: BullionResolutionResult['derivedFrom'] = directBasis ? 'title' : 'unknown';

  if (!basis) {
    const cached = await loadCachedNumistaResult(metadata);
    if (cached?.matchedType) {
      basis = buildBullionBasis(metadata, cached.matchedType);
      if (basis) {
        derivedFrom = 'numista-cache';
      }
    }
  }

  const metal = basis?.metal ?? (metadata.metalHint === 'silver' || metadata.metalHint === 'gold'
    ? metadata.metalHint
    : undefined);

  if (!metal) {
    return {
      status: 'needs-input',
      source: 'api',
      derivedFrom: 'unknown',
      message: 'Metal could not be determined from the lot title.',
    };
  }

  try {
    const spot = await resolveBullionSpot(metal, 'EUR', forceRefresh);
    if (!basis) {
      return {
        status: 'needs-input',
        source: spot.source,
        derivedFrom: 'manual',
        metal,
        currency: spot.currency,
        spotPricePerOunce: spot.pricePerOunce,
        spotPricePerGram: spot.pricePerOunce / 31.1034768,
        updatedAt: spot.updatedAt,
        message: 'Fine weight could not be determined automatically.',
      };
    }

    return {
      status: 'ok',
      source: spot.source,
      derivedFrom,
      metal,
      currency: spot.currency,
      spotPricePerOunce: spot.pricePerOunce,
      spotPricePerGram: spot.pricePerOunce / 31.1034768,
      updatedAt: spot.updatedAt,
      estimate: estimateBullionValue(basis, spot),
    };
  } catch (error) {
    return {
      status: 'error',
      source: 'api',
      derivedFrom,
      metal,
      message: error instanceof Error ? error.message : 'Failed to resolve bullion value',
    };
  }
}

async function resolveNumistaMarket(
  metadata: LotSearchMetadata,
  forceRefresh = false,
): Promise<NumistaMarketResult> {
  if (!forceRefresh) {
    const cached = await loadCachedNumistaResult(metadata);
    if (cached) return await enrichResultWithBullion(metadata, cached, false);
  }

  const apiKey = await getStorageValue<string>(NUMISTA_API_KEY_STORAGE_KEY);
  if (!apiKey) {
    return {
      status: 'needs-api-key',
      source: 'api',
      searchQuery: metadata.query || metadata.title,
      year: metadata.year,
    };
  }

  try {
    const result = await resolveNumistaMarketFromApi(apiKey, metadata);
    await saveCachedNumistaResult(metadata, result);
    const enriched = await enrichResultWithBullion(metadata, result, forceRefresh);
    return {
      ...enriched,
      cachedAt: new Date().toISOString(),
    };
  } catch (error) {
    if (error instanceof NumistaAuthError) {
      await removeStorageValue(NUMISTA_API_KEY_STORAGE_KEY);
      return {
        status: 'invalid-api-key',
        source: 'api',
        searchQuery: metadata.query || metadata.title,
        year: metadata.year,
      };
    }

    return {
      status: 'error',
      source: 'api',
      searchQuery: metadata.query || metadata.title,
      year: metadata.year,
      message: error instanceof Error ? error.message : 'Unknown Numista error',
    };
  }
}

globalThis.chrome?.runtime?.onMessage.addListener((message, _sender, sendResponse) => {
  if (isFetchLotHtmlRequest(message)) {
    void fetchLotHtml(message.lotUrl)
      .then((html) => {
        sendResponse({ ok: true, html } satisfies FetchLotHtmlResponse);
      })
      .catch((error: unknown) => {
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : 'Failed to fetch lot detail',
        } satisfies FetchLotHtmlResponse);
      });

    return true;
  }

  if (isSetNumistaApiKeyRequest(message)) {
    void setStorageValues({
      [NUMISTA_API_KEY_STORAGE_KEY]: message.apiKey.trim(),
    })
      .then(() => {
        sendResponse({ ok: true } satisfies SetNumistaApiKeyResponse);
      })
      .catch((error: unknown) => {
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : 'Failed to store Numista API key',
        } satisfies SetNumistaApiKeyResponse);
      });

    return true;
  }

  if (isResolveNumistaMarketRequest(message)) {
    void resolveNumistaMarket(message.metadata, message.forceRefresh)
      .then((result) => {
        sendResponse({ ok: true, result } satisfies ResolveNumistaMarketResponse);
      })
      .catch((error: unknown) => {
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : 'Failed to resolve Numista market data',
        } satisfies ResolveNumistaMarketResponse);
      });

    return true;
  }

  if (isResolveBullionValueRequest(message)) {
    void resolveBullionValue(message.metadata, message.forceRefresh)
      .then((result) => {
        sendResponse({ ok: true, result } satisfies ResolveBullionValueResponse);
      })
      .catch((error: unknown) => {
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : 'Failed to resolve bullion value',
        } satisfies ResolveBullionValueResponse);
      });

    return true;
  }

  return undefined;
});
