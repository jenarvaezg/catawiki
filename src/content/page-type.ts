import type { PageType } from './types';

export function detectPageType(url: string): PageType {
  const pathname = new URL(url, 'https://www.catawiki.com').pathname;

  if (/^\/[a-z]{2}\/l\/\d+/.test(pathname)) return 'lot-detail';

  if (
    /^\/[a-z]{2}\/c\/\d+/.test(pathname)
    || /^\/[a-z]{2}\/search(?:\/|$)/.test(pathname)
    || /^\/[a-z]{2}\/s(?:\/|$)/.test(pathname)
    || /^\/[a-z]{2}\/feed(?:\/|$)/.test(pathname)
  ) {
    return 'listing';
  }

  return 'unknown';
}
