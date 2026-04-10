const LISTING_FILTERS_KEY = 'listingFilters.v1';

export interface ListingFilters {
  readonly maxEstimatedTotal: number | null;
  readonly maxShipping: number | null;
  readonly onlyNoReserve: boolean;
}

export interface ListingCardFilterData {
  readonly total: number | null;
  readonly shipping: number | null;
  readonly isPartial: boolean;
  readonly noReserve: boolean;
}

const DEFAULT_LISTING_FILTERS: ListingFilters = {
  maxEstimatedTotal: null,
  maxShipping: null,
  onlyNoReserve: false,
};

let listingFilters = DEFAULT_LISTING_FILTERS;
let listingFiltersPromise: Promise<ListingFilters> | null = null;
let storageSyncInstalled = false;

function getStorageArea() {
  return globalThis.chrome?.storage?.local;
}

function normalizeNumericFilter(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.round(value * 100) / 100;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') return null;
    const normalized = trimmed.replace(',', '.');
    const parsed = Number.parseFloat(normalized);
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.round(parsed * 100) / 100;
    }
  }

  return null;
}

export function normalizeListingFilters(value: unknown): ListingFilters {
  if (typeof value !== 'object' || value === null) {
    return DEFAULT_LISTING_FILTERS;
  }

  return {
    maxEstimatedTotal: normalizeNumericFilter((value as { maxEstimatedTotal?: unknown }).maxEstimatedTotal),
    maxShipping: normalizeNumericFilter((value as { maxShipping?: unknown }).maxShipping),
    onlyNoReserve: (value as { onlyNoReserve?: unknown }).onlyNoReserve === true,
  };
}

export function shouldHideByListingFilters(
  filters: ListingFilters,
  data: ListingCardFilterData,
): boolean {
  if (filters.onlyNoReserve && !data.noReserve) {
    return true;
  }

  if (filters.maxEstimatedTotal !== null && data.total !== null && data.total > filters.maxEstimatedTotal) {
    return true;
  }

  if (filters.maxShipping !== null && data.shipping !== null && data.shipping > filters.maxShipping) {
    return true;
  }

  return false;
}

function installStorageSync(): void {
  if (storageSyncInstalled) return;

  const onChanged = globalThis.chrome?.storage?.onChanged;
  if (!onChanged?.addListener) return;

  onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local' || !(LISTING_FILTERS_KEY in changes)) return;
    listingFilters = normalizeListingFilters(changes[LISTING_FILTERS_KEY]?.newValue);
    listingFiltersPromise = Promise.resolve(listingFilters);
  });

  storageSyncInstalled = true;
}

export function getListingFilters(): Promise<ListingFilters> {
  installStorageSync();

  if (listingFiltersPromise) {
    return listingFiltersPromise;
  }

  const loadPromise = new Promise<ListingFilters>((resolve, reject) => {
    const storage = getStorageArea();
    if (!storage?.get) {
      resolve(listingFilters);
      return;
    }

    storage.get(LISTING_FILTERS_KEY, (items) => {
      const runtimeError = globalThis.chrome?.runtime?.lastError;
      if (runtimeError) {
        reject(new Error(runtimeError.message ?? 'Listing filters read failed'));
        return;
      }

      listingFilters = normalizeListingFilters(items?.[LISTING_FILTERS_KEY]);
      resolve(listingFilters);
    });
  });

  listingFiltersPromise = loadPromise.catch((error) => {
    listingFiltersPromise = null;
    throw error;
  });

  return listingFiltersPromise;
}

export async function setListingFilters(nextFilters: ListingFilters): Promise<void> {
  listingFilters = normalizeListingFilters(nextFilters);
  listingFiltersPromise = Promise.resolve(listingFilters);

  const storage = getStorageArea();
  if (!storage?.set) return;

  await new Promise<void>((resolve, reject) => {
    storage.set({ [LISTING_FILTERS_KEY]: listingFilters }, () => {
      const runtimeError = globalThis.chrome?.runtime?.lastError;
      if (runtimeError) {
        reject(new Error(runtimeError.message ?? 'Listing filters write failed'));
        return;
      }

      resolve();
    });
  });
}

export async function resetListingFilters(): Promise<void> {
  await setListingFilters(DEFAULT_LISTING_FILTERS);
}
