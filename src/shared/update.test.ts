import { describe, expect, it } from 'vitest';

import { compareExtensionVersions, isReleaseNewerThanBuild, parseReleaseTag } from './update';

describe('parseReleaseTag', () => {
  it('parses snapshot tags with version and sha', () => {
    expect(parseReleaseTag('snapshot-v0.1.0-abc1234')).toEqual({
      version: '0.1.0',
      shortSha: 'abc1234',
    });
  });

  it('parses plain version tags', () => {
    expect(parseReleaseTag('v1.2.3')).toEqual({
      version: '1.2.3',
      shortSha: null,
    });
  });

  it('returns null parts for unknown tags', () => {
    expect(parseReleaseTag('release-latest')).toEqual({
      version: null,
      shortSha: null,
    });
  });
});

describe('compareExtensionVersions', () => {
  it('compares dotted numeric versions correctly', () => {
    expect(compareExtensionVersions('1.2.0', '1.1.9')).toBe(1);
    expect(compareExtensionVersions('1.0', '1.0.0')).toBe(0);
    expect(compareExtensionVersions('0.9.9', '1.0.0')).toBe(-1);
  });
});

describe('isReleaseNewerThanBuild', () => {
  it('treats a newer semantic version as newer', () => {
    expect(isReleaseNewerThanBuild({
      tagName: 'v9.9.9',
      url: 'https://example.com',
      version: '9.9.9',
      shortSha: null,
    })).toBe(true);
  });

  it('treats same version but different snapshot sha as newer', () => {
    expect(isReleaseNewerThanBuild({
      tagName: 'snapshot-v0.0.0-deadbee',
      url: 'https://example.com',
      version: '0.0.0',
      shortSha: 'deadbee',
    })).toBe(true);
  });
});
