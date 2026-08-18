/**
 * apkdown-cli
 * Multi-Source APK & Split Downloader Library & CLI
 */

// Core Domain
export * from './core/types.js';
export * from './core/constants.js';
export * from './core/errors.js';
export * from './core/config.js';
export * from './core/downloader.js';

// HTTP Networking Layer
export * from './http/client.js';
export * from './http/fetch-client.js';
export * from './http/curl-client.js';
export * from './http/hybrid-client.js';

// Providers
export * from './providers/base.js';
export * from './providers/registry.js';
export * from './providers/aptoide.js';
export * from './providers/apkmirror.js';
export * from './providers/apkpure.js';
export * from './providers/apkcombo.js';
export * from './providers/fdroid.js';
export * from './providers/izzyondroid.js';
export * from './providers/github.js';
export * from './providers/appgallery.js';

// Utilities
export * from './utils/arch.js';
export * from './utils/formatting.js';
export * from './utils/hash.js';
export * from './utils/version.js';
export * from './utils/ci.js';

// Convenient Top-Level Helper Functions
import { providerRegistry } from './providers/registry.js';
import { ApkDownloader } from './core/downloader.js';
import { AppDetails, AppSearchResult, DownloadOptions, DownloadResult, SearchOptions } from './core/types.js';

/**
 * Searches for APKs across one or all providers
 */
export async function searchApks(options: SearchOptions): Promise<AppSearchResult[]> {
  return providerRegistry.search(options);
}

/**
 * Retrieves detailed app information and all variant architectures
 */
export async function getAppDetails(provider: string, appId: string): Promise<AppDetails> {
  const p = providerRegistry.get(provider);
  if (!p) {
    throw new Error(`Provider "${provider}" not found`);
  }
  return p.getAppDetails(appId);
}

/**
 * Downloads an APK or split variant
 */
export async function downloadApk(
  provider: string,
  appId: string,
  options: DownloadOptions = {}
): Promise<DownloadResult> {
  return ApkDownloader.download(provider, appId, options);
}
