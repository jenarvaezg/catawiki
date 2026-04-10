const IGNORED_LOTS_KEY = 'ignoredLots.v2';
const LEGACY_IGNORED_LOT_IDS_KEY = 'ignoredLotIds.v1';

export interface IgnoredLotEntry {
  readonly lotId: string;
  readonly lotUrl: string;
  readonly title: string;
  readonly ignoredAt: string;
}

export interface IgnoreLotInput {
  readonly lotId: string;
  readonly lotUrl?: string | null;
  readonly title?: string | null;
}

let ignoredLots: IgnoredLotEntry[] = [];
let ignoredLotsPromise: Promise<readonly IgnoredLotEntry[]> | null = null;
let storageSyncInstalled = false;

function getStorageArea() {
  return globalThis.chrome?.storage?.local;
}

function getDefaultLotUrl(lotId: string): string {
  const origin = globalThis.location?.origin ?? 'https://www.catawiki.com';
  const locale = globalThis.location?.pathname.match(/^\/([a-z]{2})(?:\/|$)/)?.[1] ?? 'en';
  return `${origin}/${locale}/l/${lotId}`;
}

function normalizeLotId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const lotId = value.trim();
  return lotId.length > 0 ? lotId : null;
}

function normalizeTitle(value: unknown, lotId: string): string {
  if (typeof value === 'string' && value.trim() !== '') {
    return value.trim();
  }

  return `Lot ${lotId}`;
}

function normalizeLotUrl(value: unknown, lotId: string): string {
  if (typeof value === 'string' && value.trim() !== '') {
    return value.trim();
  }

  return getDefaultLotUrl(lotId);
}

function normalizeIgnoredLotEntry(value: unknown): IgnoredLotEntry | null {
  if (typeof value === 'string') {
    const lotId = normalizeLotId(value);
    if (!lotId) return null;

    return {
      lotId,
      lotUrl: getDefaultLotUrl(lotId),
      title: `Lot ${lotId}`,
      ignoredAt: new Date(0).toISOString(),
    };
  }

  if (typeof value !== 'object' || value === null) return null;

  const lotId = normalizeLotId((value as { lotId?: unknown }).lotId);
  if (!lotId) return null;

  const ignoredAtRaw = (value as { ignoredAt?: unknown }).ignoredAt;
  const ignoredAt = typeof ignoredAtRaw === 'string' && ignoredAtRaw !== ''
    ? ignoredAtRaw
    : new Date(0).toISOString();

  return {
    lotId,
    lotUrl: normalizeLotUrl((value as { lotUrl?: unknown }).lotUrl, lotId),
    title: normalizeTitle((value as { title?: unknown }).title, lotId),
    ignoredAt,
  };
}

export function normalizeIgnoredLots(values: readonly unknown[]): IgnoredLotEntry[] {
  const deduped = new Map<string, IgnoredLotEntry>();

  values.forEach((value) => {
    const entry = normalizeIgnoredLotEntry(value);
    if (!entry) return;

    const previous = deduped.get(entry.lotId);
    if (!previous) {
      deduped.set(entry.lotId, entry);
      return;
    }

    deduped.set(entry.lotId, {
      lotId: entry.lotId,
      lotUrl: entry.lotUrl === getDefaultLotUrl(entry.lotId) ? previous.lotUrl : entry.lotUrl,
      title: entry.title === `Lot ${entry.lotId}` ? previous.title : entry.title,
      ignoredAt: entry.ignoredAt > previous.ignoredAt ? entry.ignoredAt : previous.ignoredAt,
    });
  });

  return Array.from(deduped.values())
    .sort((left, right) => right.ignoredAt.localeCompare(left.ignoredAt));
}

export function normalizeIgnoredLotIds(values: readonly unknown[]): string[] {
  return normalizeIgnoredLots(values).map((entry) => entry.lotId);
}

export function shouldHideIgnoredLot(lotId: string | null, ignoredIds: ReadonlySet<string>): boolean {
  return lotId !== null && ignoredIds.has(lotId);
}

function installStorageSync(): void {
  if (storageSyncInstalled) return;

  const onChanged = globalThis.chrome?.storage?.onChanged;
  if (!onChanged?.addListener) return;

  onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local') return;
    if (!(IGNORED_LOTS_KEY in changes) && !(LEGACY_IGNORED_LOT_IDS_KEY in changes)) return;

    const nextValue = changes?.[IGNORED_LOTS_KEY]?.newValue ?? changes?.[LEGACY_IGNORED_LOT_IDS_KEY]?.newValue;
    if (!Array.isArray(nextValue)) {
      ignoredLots = [];
      ignoredLotsPromise = Promise.resolve(ignoredLots);
      return;
    }

    ignoredLots = normalizeIgnoredLots(nextValue);
    ignoredLotsPromise = Promise.resolve(ignoredLots);
  });

  storageSyncInstalled = true;
}

function getStorageValues<T extends Record<string, unknown>>(keys: readonly string[]): Promise<T> {
  return new Promise((resolve, reject) => {
    const storage = getStorageArea();
    if (!storage?.get) {
      resolve({} as T);
      return;
    }

    storage.get([...keys], (items) => {
      const runtimeError = globalThis.chrome?.runtime?.lastError;
      if (runtimeError) {
        reject(new Error(runtimeError.message ?? 'Storage read failed'));
        return;
      }

      resolve((items ?? {}) as T);
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

export function getIgnoredLots(): Promise<readonly IgnoredLotEntry[]> {
  installStorageSync();

  if (ignoredLotsPromise) {
    return ignoredLotsPromise;
  }

  const loadPromise = getStorageValues<Record<string, unknown>>([IGNORED_LOTS_KEY, LEGACY_IGNORED_LOT_IDS_KEY])
    .then(async (items) => {
      const storedLots = Array.isArray(items[IGNORED_LOTS_KEY]) ? items[IGNORED_LOTS_KEY] as readonly unknown[] : null;
      if (storedLots) {
        ignoredLots = normalizeIgnoredLots(storedLots);
        return ignoredLots;
      }

      const legacyLots = Array.isArray(items[LEGACY_IGNORED_LOT_IDS_KEY])
        ? normalizeIgnoredLots(items[LEGACY_IGNORED_LOT_IDS_KEY] as readonly unknown[])
        : [];

      ignoredLots = legacyLots;

      if (legacyLots.length > 0) {
        await setStorageValues({ [IGNORED_LOTS_KEY]: legacyLots });
        await removeStorageValue(LEGACY_IGNORED_LOT_IDS_KEY);
      }

      return ignoredLots;
    });

  ignoredLotsPromise = loadPromise.catch((error) => {
    ignoredLotsPromise = null;
    throw error;
  });

  return ignoredLotsPromise;
}

export async function getIgnoredLotIds(): Promise<ReadonlySet<string>> {
  return new Set((await getIgnoredLots()).map((entry) => entry.lotId));
}

export async function ignoreLot(input: IgnoreLotInput): Promise<void> {
  const lotId = normalizeLotId(input.lotId);
  if (!lotId) return;

  const nextIgnoredLots = [...await getIgnoredLots()];
  if (nextIgnoredLots.some((entry) => entry.lotId === lotId)) return;

  nextIgnoredLots.unshift({
    lotId,
    lotUrl: normalizeLotUrl(input.lotUrl, lotId),
    title: normalizeTitle(input.title, lotId),
    ignoredAt: new Date().toISOString(),
  });

  ignoredLots = normalizeIgnoredLots(nextIgnoredLots);
  ignoredLotsPromise = Promise.resolve(ignoredLots);

  await setStorageValues({ [IGNORED_LOTS_KEY]: ignoredLots });
}

export async function unignoreLot(lotId: string): Promise<void> {
  const normalizedLotId = normalizeLotId(lotId);
  if (!normalizedLotId) return;

  const nextIgnoredLots = (await getIgnoredLots()).filter((entry) => entry.lotId !== normalizedLotId);
  ignoredLots = nextIgnoredLots;
  ignoredLotsPromise = Promise.resolve(ignoredLots);

  await setStorageValues({ [IGNORED_LOTS_KEY]: nextIgnoredLots });
}
