import fs from 'fs';
import path from 'path';
import {
  AppDetails,
  AppSearchResult,
  AppVariant,
  Architecture,
  DownloadOptions,
  DownloadProgress,
  DownloadResult,
} from './types.js';
import { BaseProvider } from '../providers/base.js';
import { providerRegistry } from '../providers/registry.js';
import { configManager } from './config.js';
import { defaultHttpClient } from '../http/hybrid-client.js';
import { isArchCompatible } from '../utils/arch.js';
import { sanitizeFileName } from '../utils/formatting.js';
import { calculateFileHash, verifyFileChecksum } from '../utils/hash.js';
import { compareVersions } from '../utils/version.js';
import {
  ApkDownError,
  ChecksumMismatchError,
  DownloadError,
  VariantNotFoundError,
} from './errors.js';

export interface ProviderComparisonResult {
  provider: string;
  appName: string;
  packageName: string;
  version: string;
  appDetails: AppDetails;
  bestVariant: AppVariant;
}

export class ApkDownloader {
  public static selectBestVariant(
    app: AppDetails,
    options: DownloadOptions = {}
  ): AppVariant {
    const config = configManager.getAll();
    const preferredArch = options.preferredArch || options.arch || config.preferredArch;
    const requestedVersion = options.version?.toLowerCase();
    const requestedChannel = options.channel || config.defaultChannel;
    const allowBeta = options.allowBeta ?? config.includeBeta;

    if (options.variantId) {
      const found = app.variants.find((v) => v.id === options.variantId);
      if (found) return found;
    }

    // Filter by version if specified
    let candidates = [...app.variants];
    if (requestedVersion && requestedVersion !== 'latest') {
      candidates = candidates.filter((v) =>
        v.versionName.toLowerCase().includes(requestedVersion)
      );
    }

    // Filter by channel / beta status
    if (!allowBeta && requestedChannel === 'stable') {
      const stableOnly = candidates.filter((v) => !v.isBeta);
      if (stableOnly.length > 0) {
        candidates = stableOnly;
      }
    } else if (requestedChannel !== 'all' && requestedChannel !== 'stable') {
      const channelMatches = candidates.filter(
        (v) => v.releaseChannel === requestedChannel || (v.isBeta && requestedChannel === 'beta')
      );
      if (channelMatches.length > 0) {
        candidates = channelMatches;
      }
    }

    // Filter and score by Architecture
    if (preferredArch && preferredArch !== 'all') {
      const compatible = candidates.filter((v) =>
        isArchCompatible(v.architecture, preferredArch)
      );

      if (compatible.length > 0) {
        // Prioritize exact arch match first, then universal
        const exactMatch = compatible.find((v) => v.architecture === preferredArch);
        if (exactMatch) return exactMatch;

        const universalMatch = compatible.find((v) => v.architecture === 'universal');
        if (universalMatch) return universalMatch;

        return compatible[0];
      }
    }

    if (candidates.length > 0) {
      return candidates[0];
    }

    if (app.variants.length > 0) {
      return app.variants[0];
    }

    throw new VariantNotFoundError(app.name, preferredArch || 'any', requestedVersion);
  }

  /**
   * Compares all providers that host the requested app, selects the one with the highest/latest version,
   * and downloads the best matching variant.
   */
  public static async downloadLatestAcrossProviders(
    queryOrPackage: string,
    options: DownloadOptions & { onComparison?: (candidates: ProviderComparisonResult[], chosen: ProviderComparisonResult) => void } = {}
  ): Promise<DownloadResult> {
    const config = configManager.getAll();
    const effectiveChannel = options.channel || config.defaultChannel;
    const includeBeta = options.allowBeta ?? (effectiveChannel !== 'stable');
    const preferredArch = options.preferredArch || options.arch || config.preferredArch;

    // 1. Search across active providers (taking into account exclusions and inclusions)
    const searchResults = await providerRegistry.search({
      query: queryOrPackage,
      excludeProviders: options.excludeProviders,
      includeProviders: options.includeProviders,
      limit: 3,
      includeBeta,
      arch: preferredArch,
    });

    if (searchResults.length === 0) {
      throw new ApkDownError(
        `Could not find any matching APK for "${queryOrPackage}" across active providers.`,
        'APP_NOT_FOUND'
      );
    }

    // 2. Fetch app details for the best result of each provider in parallel
    const providerMap = new Map<string, AppSearchResult>();
    for (const r of searchResults) {
      if (!providerMap.has(r.provider)) {
        providerMap.set(r.provider, r);
      }
    }

    const detailPromises = Array.from(providerMap.values()).map(async (searchItem) => {
      const p = providerRegistry.get(searchItem.provider);
      if (!p) return null;
      try {
        const details = await p.getAppDetails(searchItem.id || searchItem.packageName || searchItem.sourceUrl || queryOrPackage);
        if (!details.variants || details.variants.length === 0) return null;
        const bestVariant = ApkDownloader.selectBestVariant(details, options);
        return {
          provider: p.name,
          appName: details.name,
          packageName: details.packageName,
          version: bestVariant.versionName || details.latestVersion || 'Latest',
          appDetails: details,
          bestVariant,
        } as ProviderComparisonResult;
      } catch {
        return null;
      }
    });

    const settled = await Promise.allSettled(detailPromises);
    const candidateProviders: ProviderComparisonResult[] = [];

    for (const outcome of settled) {
      if (outcome.status === 'fulfilled' && outcome.value) {
        candidateProviders.push(outcome.value);
      }
    }

    if (candidateProviders.length === 0) {
      // Fallback to top search item directly
      const top = searchResults[0];
      return await ApkDownloader.download(top.provider, top.id, options);
    }

    // 3. Sort candidates by latest version (newest first)
    candidateProviders.sort((a, b) => compareVersions(b.version, a.version));

    const chosen = candidateProviders[0];

    if (options.onComparison) {
      options.onComparison(candidateProviders, chosen);
    }

    // 4. Download from the winner provider
    return await ApkDownloader.download(chosen.provider, chosen.appDetails.id || chosen.packageName, options);
  }

  public static async download(
    providerName: string | undefined,
    appIdOrPackage: string,
    options: DownloadOptions = {}
  ): Promise<DownloadResult> {
    if (!providerName || providerName.toLowerCase() === 'all') {
      return ApkDownloader.downloadLatestAcrossProviders(appIdOrPackage, options);
    }

    const provider: BaseProvider | undefined = providerRegistry.get(providerName);
    if (!provider) {
      throw new DownloadError(`Provider "${providerName}" is not registered`);
    }

    const config = configManager.getAll();
    const outputDir = options.outputDir || config.downloadDir;

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // 1. Fetch full app details and select best matching variant
    const appDetails = await provider.getAppDetails(appIdOrPackage);
    const variant = ApkDownloader.selectBestVariant(appDetails, options);

    // 2. Resolve final direct download link
    const downloadUrl = await provider.resolveDownloadUrl(variant);

    // 3. Determine output filename
    const ext = variant.packageType === 'XAPK' ? 'xapk' : variant.packageType === 'APKM' ? 'apkm' : 'apk';
    const cleanAppName = sanitizeFileName(appDetails.name || appDetails.packageName);
    const cleanVer = sanitizeFileName(variant.versionName || 'latest');
    const defaultFileName = `${cleanAppName}_v${cleanVer}_${variant.architecture}_${provider.name}.${ext}`;
    const fileName = options.filename ? sanitizeFileName(options.filename) : defaultFileName;
    const finalFilePath = path.join(outputDir, fileName);
    const tempFilePath = `${finalFilePath}.part`;

    if (fs.existsSync(finalFilePath) && !options.forceOverwrite) {
      const stats = fs.statSync(finalFilePath);
      const sha256 = await calculateFileHash(finalFilePath, 'sha256');
      return {
        filePath: finalFilePath,
        fileName,
        fileSizeBytes: stats.size,
        sha256,
        checksumVerified: true,
        packageType: variant.packageType,
        durationMs: 0,
      };
    }

    // 4. Download file with progress tracking
    const startTime = Date.now();
    let lastProgressTime = startTime;
    let lastBytes = 0;

    const progressTracker: DownloadProgress = {
      percentage: 0,
      bytesDownloaded: 0,
      totalBytes: variant.fileSizeBytes || 0,
      speedBytesPerSec: 0,
      etaSeconds: 0,
      status: 'starting',
    };

    if (options.onProgress) {
      options.onProgress({ ...progressTracker });
    }

    try {
      progressTracker.status = 'downloading';
      await defaultHttpClient.downloadFile(
        downloadUrl,
        tempFilePath,
        {
          timeoutMs: config.timeoutMs,
          headers: { Referer: appDetails.sourceUrl || provider.homepage },
        },
        (bytesWritten, totalBytes) => {
          const now = Date.now();
          const elapsed = (now - lastProgressTime) / 1000;

          if (elapsed >= 0.25 || bytesWritten === totalBytes) {
            const speed = elapsed > 0 ? (bytesWritten - lastBytes) / elapsed : 0;
            const remainingBytes = totalBytes > bytesWritten ? totalBytes - bytesWritten : 0;
            const eta = speed > 0 ? remainingBytes / speed : 0;
            const percentage = totalBytes > 0 ? Math.min(100, Math.round((bytesWritten / totalBytes) * 100)) : 0;

            progressTracker.percentage = percentage;
            progressTracker.bytesDownloaded = bytesWritten;
            progressTracker.totalBytes = totalBytes;
            progressTracker.speedBytesPerSec = speed;
            progressTracker.etaSeconds = Math.round(eta);

            if (options.onProgress) {
              options.onProgress({ ...progressTracker });
            }

            lastProgressTime = now;
            lastBytes = bytesWritten;
          }
        }
      );

      // Rename temp to final
      if (fs.existsSync(tempFilePath)) {
        fs.renameSync(tempFilePath, finalFilePath);
      }

      const totalDuration = Date.now() - startTime;
      const stats = fs.statSync(finalFilePath);

      // 5. Verification
      progressTracker.status = 'verifying';
      if (options.onProgress) {
        options.onProgress({ ...progressTracker });
      }

      let checksumVerified = false;
      let sha256Hash: string | undefined = undefined;
      let md5Hash: string | undefined = undefined;

      if (options.verifyChecksum ?? config.verifyChecksums) {
        if (variant.hashes?.sha256) {
          sha256Hash = await calculateFileHash(finalFilePath, 'sha256');
          const ok = await verifyFileChecksum(finalFilePath, variant.hashes.sha256, 'sha256');
          if (!ok) {
            fs.unlinkSync(finalFilePath);
            throw new ChecksumMismatchError(variant.hashes.sha256, sha256Hash, 'SHA256');
          }
          checksumVerified = true;
        } else if (variant.hashes?.md5) {
          md5Hash = await calculateFileHash(finalFilePath, 'md5');
          const ok = await verifyFileChecksum(finalFilePath, variant.hashes.md5, 'md5');
          if (!ok) {
            fs.unlinkSync(finalFilePath);
            throw new ChecksumMismatchError(variant.hashes.md5, md5Hash, 'MD5');
          }
          checksumVerified = true;
        } else {
          sha256Hash = await calculateFileHash(finalFilePath, 'sha256');
        }
      } else {
        sha256Hash = await calculateFileHash(finalFilePath, 'sha256');
      }

      progressTracker.status = 'completed';
      progressTracker.percentage = 100;
      if (options.onProgress) {
        options.onProgress({ ...progressTracker });
      }

      return {
        filePath: finalFilePath,
        fileName,
        fileSizeBytes: stats.size,
        sha256: sha256Hash,
        md5: md5Hash,
        checksumVerified,
        packageType: variant.packageType,
        durationMs: totalDuration,
      };
    } catch (err: any) {
      progressTracker.status = 'failed';
      if (options.onProgress) {
        options.onProgress({ ...progressTracker });
      }
      if (fs.existsSync(tempFilePath)) {
        try {
          fs.unlinkSync(tempFilePath);
        } catch {}
      }
      throw err;
    }
  }
}
