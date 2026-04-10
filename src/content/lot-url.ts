export function getCanonicalLotUrl(rawUrl: string): string {
  const url = new URL(rawUrl, window.location.href);
  const viewLotId = url.searchParams.get('view_lot');

  if (viewLotId) {
    return `${url.origin}/${getLocaleSegment(url.pathname)}/l/${viewLotId}`;
  }

  return url.toString();
}

export function getLotIdFromUrl(rawUrl: string): string | null {
  const canonicalUrl = getCanonicalLotUrl(rawUrl);
  const url = new URL(canonicalUrl, window.location.href);
  const match = url.pathname.match(/\/l\/(\d+)/);
  return match?.[1] ?? null;
}

function getLocaleSegment(pathname: string): string {
  const match = pathname.match(/^\/([a-z]{2})(?:\/|$)/);
  return match?.[1] ?? 'en';
}
