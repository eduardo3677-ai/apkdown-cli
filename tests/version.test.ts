import { describe, it, expect } from 'vitest';
import { compareVersions, normalizeVersionString } from '../src/utils/version.js';

describe('Version Utilities', () => {
  it('should normalize version strings accurately', () => {
    expect(normalizeVersionString('12.10.0')).toEqual([12, 10, 0]);
    expect(normalizeVersionString('v2.26.29.73')).toEqual([2, 26, 29, 73]);
    expect(normalizeVersionString('version_1.0.0-beta')).toEqual([1, 0, 0]);
    expect(normalizeVersionString('Latest')).toEqual([0]);
  });

  it('should compare standard versions correctly', () => {
    expect(compareVersions('12.10.0', '12.9.2')).toBeGreaterThan(0); // 12.10.0 is newer than 12.9.2
    expect(compareVersions('12.9.2', '12.10.0')).toBeLessThan(0);
    expect(compareVersions('2.26.30.97', '2.26.29.73')).toBeGreaterThan(0);
    expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
    expect(compareVersions('1.0.1', '1.0')).toBeGreaterThan(0);
  });

  it('should handle version codes and latest string', () => {
    expect(compareVersions('v10013004', 'v10012000')).toBeGreaterThan(0);
    expect(compareVersions('12.9.0', 'Latest')).toBeGreaterThan(0);
    expect(compareVersions('Latest', '12.9.0')).toBeLessThan(0);
  });
});
