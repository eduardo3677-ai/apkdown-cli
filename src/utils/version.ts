/**
 * Version comparison and semver normalization utilities for APKs
 */

/**
 * Normalizes version strings for comparison
 */
export function normalizeVersionString(version: string): number[] {
  if (!version || version.toLowerCase() === 'latest') {
    return [0];
  }

  // Remove common prefixes
  const clean = version
    .replace(/^v(ersion)?[\s-_]*/i, '')
    .replace(/[^\d.a-zA-Z]/g, '.')
    .trim();

  // Extract all digit chunks
  const parts = clean.split(/[.\-_]+/).filter(Boolean);
  const numericParts: number[] = [];

  for (const part of parts) {
    const num = parseInt(part, 10);
    if (!isNaN(num)) {
      numericParts.push(num);
    }
  }

  return numericParts.length > 0 ? numericParts : [0];
}

/**
 * Compares two version strings.
 * Returns:
 *   > 0 if v1 > v2 (v1 is newer)
 *   < 0 if v1 < v2 (v2 is newer)
 *   0 if equal
 */
export function compareVersions(v1: string = '', v2: string = ''): number {
  const p1 = normalizeVersionString(v1);
  const p2 = normalizeVersionString(v2);

  const maxLen = Math.max(p1.length, p2.length);

  for (let i = 0; i < maxLen; i++) {
    const num1 = p1[i] !== undefined ? p1[i] : 0;
    const num2 = p2[i] !== undefined ? p2[i] : 0;

    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }

  // If one is string "Latest" and other has numbers, the numeric one is preferred
  const v1IsLatest = !v1 || v1.toLowerCase() === 'latest';
  const v2IsLatest = !v2 || v2.toLowerCase() === 'latest';

  if (v1IsLatest && !v2IsLatest) return -1;
  if (!v1IsLatest && v2IsLatest) return 1;

  return 0;
}
