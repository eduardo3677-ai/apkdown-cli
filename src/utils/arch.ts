import { Architecture, ReleaseChannel } from '../core/types.js';
import { BETA_KEYWORDS } from '../core/constants.js';
import os from 'os';

/**
 * Normalizes architecture strings into standard Architecture enum values
 */
export function normalizeArch(archStr?: string): Architecture {
  if (!archStr) return 'universal';
  const clean = archStr.toLowerCase().trim();

  if (clean.includes('arm64') || clean.includes('aarch64') || clean.includes('v8a') || clean.includes('arm64-v8a')) {
    return 'arm64-v8a';
  }
  if (clean.includes('armeabi-v7a') || clean.includes('armv7') || clean.includes('v7a') || clean.includes('armv7a')) {
    return 'armeabi-v7a';
  }
  if (clean.includes('armeabi') || clean.includes('armv6')) {
    return 'armeabi';
  }
  if (clean.includes('x86_64') || clean.includes('x64') || clean.includes('amd64')) {
    return 'x86_64';
  }
  if (clean.includes('x86') || clean.includes('i386') || clean.includes('i686')) {
    return 'x86';
  }
  if (clean.includes('universal') || clean.includes('all') || clean.includes('noarch') || clean.includes('fat') || clean === '') {
    return 'universal';
  }

  return 'universal';
}

/**
 * Checks if a target variant architecture is compatible with a requested architecture
 */
export function isArchCompatible(targetArch: Architecture, requestedArch: Architecture): boolean {
  if (requestedArch === 'all' || targetArch === 'universal' || targetArch === 'all') {
    return true;
  }
  if (targetArch === requestedArch) {
    return true;
  }
  // arm64-v8a devices can run armeabi-v7a in backwards compatibility mode
  if (requestedArch === 'arm64-v8a' && (targetArch === 'armeabi-v7a' || targetArch === 'armeabi')) {
    return true;
  }
  // x86_64 devices can run x86
  if (requestedArch === 'x86_64' && targetArch === 'x86') {
    return true;
  }
  return false;
}

/**
 * Detects the host system architecture as an Android target equivalent
 */
export function detectSystemArch(): Architecture {
  const nodeArch = os.arch();
  switch (nodeArch) {
    case 'arm64':
      return 'arm64-v8a';
    case 'arm':
      return 'armeabi-v7a';
    case 'x64':
      return 'x86_64';
    case 'ia32':
      return 'x86';
    default:
      return 'universal';
  }
}

/**
 * Detects release channel and beta status from version string and release notes
 */
export function detectReleaseChannel(
  versionName: string = '',
  notes: string = ''
): { isBeta: boolean; channel: ReleaseChannel } {
  const combined = `${versionName} ${notes}`.toLowerCase();

  if (combined.includes('alpha')) {
    return { isBeta: true, channel: 'alpha' };
  }
  if (combined.includes('preview') || combined.includes('canary')) {
    return { isBeta: true, channel: 'preview' };
  }
  if (combined.includes('insider')) {
    return { isBeta: true, channel: 'insider' };
  }
  if (
    combined.includes('beta') ||
    combined.includes('dev') ||
    combined.includes('rc') ||
    combined.includes('nightly') ||
    combined.includes('experimental') ||
    combined.includes('prerelease')
  ) {
    return { isBeta: true, channel: 'beta' };
  }

  // Check against general beta keywords
  for (const kw of BETA_KEYWORDS) {
    if (combined.includes(kw)) {
      return { isBeta: true, channel: 'beta' };
    }
  }

  return { isBeta: false, channel: 'stable' };
}
