import type { Platform } from './platform';
import { CatawikiPlatform } from './catawiki/adapter';
import { WallapopPlatform } from './wallapop/adapter';

const platforms: readonly Platform[] = [
  new CatawikiPlatform(),
  new WallapopPlatform(),
];

export function detectPlatform(url: string): Platform | null {
  let hostname: string;
  try {
    hostname = new URL(url).hostname;
  } catch {
    return null;
  }

  for (const platform of platforms) {
    if (platform.detectPageType(url) !== 'unknown') {
      return platform;
    }
  }

  // Fall back to host matching for pages we don't inject on but still recognize
  if (hostname.endsWith('catawiki.com')) return platforms[0];
  if (hostname.endsWith('wallapop.com')) return platforms[1];

  return null;
}
