declare const __EXT_VERSION__: string;
declare const __BUILD_SHA__: string;
declare const __BUILD_TIMESTAMP__: string;
declare const __RELEASES_PAGE_URL__: string;

export const BUILD_INFO = {
  version: typeof __EXT_VERSION__ !== 'undefined' ? __EXT_VERSION__ : '0.0.0',
  shortSha: typeof __BUILD_SHA__ !== 'undefined' ? __BUILD_SHA__ : 'local',
  builtAt: typeof __BUILD_TIMESTAMP__ !== 'undefined' ? __BUILD_TIMESTAMP__ : new Date(0).toISOString(),
  releasesPageUrl: typeof __RELEASES_PAGE_URL__ !== 'undefined'
    ? __RELEASES_PAGE_URL__
    : 'https://github.com/jenarvaezg/coinscope/releases',
} as const;
