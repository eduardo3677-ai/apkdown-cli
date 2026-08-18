import { describe, it, expect } from 'vitest';
import { normalizeArch, isArchCompatible, detectReleaseChannel } from '../src/utils/arch.js';

describe('Architecture Utilities', () => {
  it('should normalize architecture strings accurately', () => {
    expect(normalizeArch('arm64-v8a')).toBe('arm64-v8a');
    expect(normalizeArch('aarch64')).toBe('arm64-v8a');
    expect(normalizeArch('armeabi-v7a')).toBe('armeabi-v7a');
    expect(normalizeArch('armv7')).toBe('armeabi-v7a');
    expect(normalizeArch('x86_64')).toBe('x86_64');
    expect(normalizeArch('x86')).toBe('x86');
    expect(normalizeArch('universal')).toBe('universal');
    expect(normalizeArch('noarch')).toBe('universal');
    expect(normalizeArch('')).toBe('universal');
  });

  it('should check architecture compatibility correctly', () => {
    expect(isArchCompatible('arm64-v8a', 'arm64-v8a')).toBe(true);
    expect(isArchCompatible('universal', 'arm64-v8a')).toBe(true);
    expect(isArchCompatible('armeabi-v7a', 'arm64-v8a')).toBe(true); // Backwards compatible
    expect(isArchCompatible('arm64-v8a', 'armeabi-v7a')).toBe(false);
    expect(isArchCompatible('x86', 'x86_64')).toBe(true);
    expect(isArchCompatible('x86_64', 'arm64-v8a')).toBe(false);
  });

  it('should detect release channel and beta status', () => {
    expect(detectReleaseChannel('12.9.2-beta.1')).toEqual({ isBeta: true, channel: 'beta' });
    expect(detectReleaseChannel('2.0.0-alpha')).toEqual({ isBeta: true, channel: 'alpha' });
    expect(detectReleaseChannel('1.5.0-preview2')).toEqual({ isBeta: true, channel: 'preview' });
    expect(detectReleaseChannel('10.0-insider')).toEqual({ isBeta: true, channel: 'insider' });
    expect(detectReleaseChannel('5.4.1')).toEqual({ isBeta: false, channel: 'stable' });
  });
});
