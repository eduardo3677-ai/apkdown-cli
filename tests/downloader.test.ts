import { describe, it, expect } from 'vitest';
import { ApkDownloader } from '../src/core/downloader.js';
import { AppDetails, AppVariant } from '../src/core/types.js';

describe('ApkDownloader Variant Selection', () => {
  const mockApp: AppDetails = {
    id: 'org.example.app',
    name: 'Example App',
    packageName: 'org.example.app',
    provider: 'aptoide',
    latestVersion: '2.0.0',
    variants: [
      {
        id: 'var-stable-arm64',
        versionName: '2.0.0',
        architecture: 'arm64-v8a',
        packageType: 'APK',
        isBeta: false,
        releaseChannel: 'stable',
      },
      {
        id: 'var-stable-armv7',
        versionName: '2.0.0',
        architecture: 'armeabi-v7a',
        packageType: 'APK',
        isBeta: false,
        releaseChannel: 'stable',
      },
      {
        id: 'var-beta-arm64',
        versionName: '2.1.0-beta',
        architecture: 'arm64-v8a',
        packageType: 'APK',
        isBeta: true,
        releaseChannel: 'beta',
      },
    ],
  };

  it('should pick exact stable arm64 variant by default', () => {
    const variant = ApkDownloader.selectBestVariant(mockApp, {
      preferredArch: 'arm64-v8a',
      allowBeta: false,
    });
    expect(variant.id).toBe('var-stable-arm64');
  });

  it('should pick beta variant when beta is requested', () => {
    const variant = ApkDownloader.selectBestVariant(mockApp, {
      preferredArch: 'arm64-v8a',
      channel: 'beta',
      allowBeta: true,
    });
    expect(variant.id).toBe('var-beta-arm64');
  });

  it('should pick armv7 variant when armv7 is preferred', () => {
    const variant = ApkDownloader.selectBestVariant(mockApp, {
      preferredArch: 'armeabi-v7a',
      allowBeta: false,
    });
    expect(variant.id).toBe('var-stable-armv7');
  });
});

describe('Downloaded package validation', () => {
  it('accepts ZIP-based APK/XAPK/APKM signatures and rejects HTML error pages', async () => {
    const fs = await import('fs');
    const os = await import('os');
    const path = await import('path');
    const { isValidAndroidPackageArchive } = await import('../src/core/downloader.js');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'apkdown-signature-'));
    const apk = path.join(dir, 'valid.apk');
    const html = path.join(dir, 'blocked.apk');
    fs.writeFileSync(apk, Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00]));
    fs.writeFileSync(html, '<html>403 Forbidden</html>');

    expect(isValidAndroidPackageArchive(apk)).toBe(true);
    expect(isValidAndroidPackageArchive(html)).toBe(false);
  });
});
