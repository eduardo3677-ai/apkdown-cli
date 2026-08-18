import { ApkDownConfig, Architecture, ReleaseChannel } from './types.js';
import path from 'path';
import os from 'os';

export const DEFAULT_USER_AGENT = 
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';

export const CHROME_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

export const ANDROID_USER_AGENT =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36';

export const DEFAULT_DOWNLOAD_DIR = path.join(os.homedir(), 'Downloads', 'apks');

export const DEFAULT_CONFIG: ApkDownConfig = {
  downloadDir: DEFAULT_DOWNLOAD_DIR,
  defaultProvider: 'all',
  preferredArch: 'arm64-v8a',
  includeBeta: false,
  defaultChannel: 'stable',
  maxConcurrency: 3,
  timeoutMs: 25000,
  verifyChecksums: true,
  userAgent: DEFAULT_USER_AGENT,
  providers: {
    aptoide: true,
    apkmirror: true,
    apkpure: true,
    apkcombo: true,
    fdroid: true,
    github: true,
    appgallery: true,
  },
};

export const SUPPORTED_ARCHITECTURES: Architecture[] = [
  'arm64-v8a',
  'armeabi-v7a',
  'armeabi',
  'x86',
  'x86_64',
  'universal',
  'all',
];

export const RELEASE_CHANNELS: ReleaseChannel[] = [
  'stable',
  'beta',
  'alpha',
  'insider',
  'preview',
  'all',
];

export const BETA_KEYWORDS = [
  'beta',
  'alpha',
  'dev',
  'canary',
  'preview',
  'insider',
  'rc',
  'nightly',
  'experimental',
  'test',
  'staging',
  'prerelease',
];
