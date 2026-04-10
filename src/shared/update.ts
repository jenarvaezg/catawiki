import { BUILD_INFO } from './build-info';

const SNAPSHOT_TAG_PATTERN = /^snapshot-v(\d+(?:\.\d+){0,3})-([0-9a-f]{7,40})$/i;
const VERSION_TAG_PATTERN = /^v?(\d+(?:\.\d+){0,3})$/i;

export interface ParsedReleaseTag {
  readonly version: string | null;
  readonly shortSha: string | null;
}

export interface UpdateReleaseSummary {
  readonly tagName: string;
  readonly url: string;
  readonly publishedAt?: string;
  readonly version: string | null;
  readonly shortSha: string | null;
}

export interface ExtensionUpdateState {
  readonly status: 'up-to-date' | 'update-available' | 'error';
  readonly source: 'api' | 'cache';
  readonly currentVersion: string;
  readonly currentSha: string;
  readonly latestTag?: string;
  readonly latestVersion?: string | null;
  readonly latestSha?: string | null;
  readonly url?: string;
  readonly publishedAt?: string;
  readonly checkedAt?: string;
  readonly message?: string;
}

export function parseReleaseTag(tagName: string): ParsedReleaseTag {
  const snapshotMatch = SNAPSHOT_TAG_PATTERN.exec(tagName.trim());
  if (snapshotMatch) {
    return {
      version: snapshotMatch[1] ?? null,
      shortSha: snapshotMatch[2]?.toLowerCase() ?? null,
    };
  }

  const versionMatch = VERSION_TAG_PATTERN.exec(tagName.trim());
  if (versionMatch) {
    return {
      version: versionMatch[1] ?? null,
      shortSha: null,
    };
  }

  return {
    version: null,
    shortSha: null,
  };
}

export function compareExtensionVersions(left: string, right: string): number {
  const leftParts = left.split('.').map((part) => Number.parseInt(part, 10) || 0);
  const rightParts = right.split('.').map((part) => Number.parseInt(part, 10) || 0);
  const maxLength = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < maxLength; index += 1) {
    const leftPart = leftParts[index] ?? 0;
    const rightPart = rightParts[index] ?? 0;
    if (leftPart > rightPart) return 1;
    if (leftPart < rightPart) return -1;
  }

  return 0;
}

export function isReleaseNewerThanBuild(release: UpdateReleaseSummary): boolean {
  if (!release.version) return false;

  const versionComparison = compareExtensionVersions(release.version, BUILD_INFO.version);
  if (versionComparison > 0) return true;
  if (versionComparison < 0) return false;

  if (!release.shortSha || !BUILD_INFO.shortSha) return false;
  return release.shortSha !== BUILD_INFO.shortSha.toLowerCase();
}
