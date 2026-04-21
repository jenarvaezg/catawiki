const BIDDER_MAPPING_KEY = 'bidderMapping.v1';

export type BidderMapping = Readonly<Record<string, string>>;

let cached: BidderMapping = {};
let cachedPromise: Promise<BidderMapping> | null = null;
let storageSyncInstalled = false;
const listeners: Array<(mapping: BidderMapping) => void> = [];

function getStorageArea() {
  return globalThis.chrome?.storage?.local;
}

export function normalizeBidderId(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(Math.trunc(value));
  }
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const match = /\d+/.exec(trimmed);
  return match ? match[0] : null;
}

function normalizeBidderName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function normalizeBidderMapping(value: unknown): BidderMapping {
  if (typeof value !== 'object' || value === null) return {};

  const result: Record<string, string> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    const id = normalizeBidderId(key);
    const name = normalizeBidderName(val);
    if (id !== null && name !== null) {
      result[id] = name;
    }
  }
  return result;
}

function notifyListeners(mapping: BidderMapping): void {
  listeners.slice().forEach((fn) => {
    try {
      fn(mapping);
    } catch {
      // keep going, a broken listener shouldn't stop the others
    }
  });
}

function installStorageSync(): void {
  if (storageSyncInstalled) return;

  const onChanged = globalThis.chrome?.storage?.onChanged;
  if (!onChanged?.addListener) return;

  onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local' || !(BIDDER_MAPPING_KEY in changes)) return;
    cached = normalizeBidderMapping(changes[BIDDER_MAPPING_KEY]?.newValue);
    cachedPromise = Promise.resolve(cached);
    notifyListeners(cached);
  });

  storageSyncInstalled = true;
}

export function getBidderMapping(): Promise<BidderMapping> {
  installStorageSync();
  if (cachedPromise) return cachedPromise;

  const loadPromise = new Promise<BidderMapping>((resolve, reject) => {
    const storage = getStorageArea();
    if (!storage?.get) {
      resolve(cached);
      return;
    }

    storage.get(BIDDER_MAPPING_KEY, (items) => {
      const runtimeError = globalThis.chrome?.runtime?.lastError;
      if (runtimeError) {
        reject(new Error(runtimeError.message ?? 'Bidder mapping read failed'));
        return;
      }
      cached = normalizeBidderMapping(items?.[BIDDER_MAPPING_KEY]);
      resolve(cached);
    });
  });

  cachedPromise = loadPromise.catch((error) => {
    cachedPromise = null;
    throw error;
  });

  return cachedPromise;
}

export function getBidderMappingSync(): BidderMapping {
  return cached;
}

export async function setBidderMapping(mapping: BidderMapping): Promise<void> {
  cached = normalizeBidderMapping(mapping);
  cachedPromise = Promise.resolve(cached);
  notifyListeners(cached);

  const storage = getStorageArea();
  if (!storage?.set) return;

  await new Promise<void>((resolve, reject) => {
    storage.set({ [BIDDER_MAPPING_KEY]: cached }, () => {
      const runtimeError = globalThis.chrome?.runtime?.lastError;
      if (runtimeError) {
        reject(new Error(runtimeError.message ?? 'Bidder mapping write failed'));
        return;
      }
      resolve();
    });
  });
}

export async function addBidder(id: string, name: string): Promise<boolean> {
  const normalizedId = normalizeBidderId(id);
  const normalizedName = normalizeBidderName(name);
  if (!normalizedId || !normalizedName) return false;

  const current = await getBidderMapping();
  await setBidderMapping({ ...current, [normalizedId]: normalizedName });
  return true;
}

export async function removeBidder(id: string): Promise<void> {
  const normalizedId = normalizeBidderId(id);
  if (!normalizedId) return;

  const current = await getBidderMapping();
  if (!(normalizedId in current)) return;

  const { [normalizedId]: _removed, ...rest } = current;
  await setBidderMapping(rest);
}

export function onBidderMappingChange(listener: (mapping: BidderMapping) => void): () => void {
  installStorageSync();
  listeners.push(listener);
  return () => {
    const idx = listeners.indexOf(listener);
    if (idx >= 0) listeners.splice(idx, 1);
  };
}
