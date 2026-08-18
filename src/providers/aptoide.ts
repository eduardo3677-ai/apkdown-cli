import { BaseProvider } from './base.js';
import {
  AppDetails,
  AppSearchResult,
  AppVariant,
  ProviderSearchOptions,
} from '../core/types.js';
import { ProviderError } from '../core/errors.js';
import { formatBytes } from '../utils/formatting.js';
import { detectReleaseChannel, normalizeArch } from '../utils/arch.js';

export class AptoideProvider extends BaseProvider {
  public readonly name = 'aptoide';
  public readonly displayName = 'Aptoide App Store';
  public readonly description = 'Official open Aptoide marketplace with verified APK hashes & malware scanning';
  public readonly homepage = 'https://aptoide.com';

  private baseUrl = 'https://ws75.aptoide.com/api/7';

  public async search(query: string, options: ProviderSearchOptions = {}): Promise<AppSearchResult[]> {
    const limit = options.limit || 15;
    const url = `${this.baseUrl}/apps/search?query=${encodeURIComponent(query)}&limit=${limit}`;

    try {
      const res = await this.http.get(url, { responseType: 'json' });
      const data = res.data;
      const list = data?.datalist?.list || [];

      return list.map((item: any): AppSearchResult => {
        return {
          id: item.package || String(item.id),
          name: item.name || 'Unknown',
          packageName: item.package || '',
          developer: item.developer?.name || item.store?.name || 'Aptoide Dev',
          version: item.file?.vername || 'Latest',
          iconUrl: item.icon || item.graphic,
          description: item.media?.description || `${item.name} on Aptoide`,
          provider: this.name,
          rating: item.stats?.rating?.avg ? Number(item.stats.rating.avg.toFixed(1)) : undefined,
          downloads: item.stats?.downloads || item.stats?.pdownloads,
          sourceUrl: `https://${item.uname || item.package}.en.aptoide.com/app`,
          updatedAt: item.updated || item.modified,
        };
      });
    } catch (err: any) {
      throw new ProviderError(this.name, `Search failed: ${err.message}`, err);
    }
  }

  public async getAppDetails(appIdOrPackage: string): Promise<AppDetails> {
    let cleanPkg = appIdOrPackage.trim();

    // If query does not look like a package name (no dot) or is a friendly name, search first
    if (!cleanPkg.includes('.')) {
      const searchResults = await this.search(cleanPkg, { limit: 1 });
      if (searchResults.length > 0) {
        cleanPkg = searchResults[0].packageName || searchResults[0].id;
      }
    }

    const url = `${this.baseUrl}/app/get/package_name=${encodeURIComponent(cleanPkg)}`;

    try {
      const res = await this.http.get(url, { responseType: 'json' });
      const meta = res.data?.nodes?.meta?.data;

      if (!meta) {
        // Fallback search by package name
        const searchResults = await this.search(cleanPkg, { limit: 3 });
        const app = searchResults.find((r) => r.packageName.toLowerCase() === cleanPkg.toLowerCase()) || searchResults[0];
        if (!app) {
          throw new ProviderError(this.name, `App "${cleanPkg}" not found on Aptoide`);
        }

        return {
          id: app.packageName || app.id,
          name: app.name,
          packageName: app.packageName,
          developer: app.developer,
          description: app.description,
          iconUrl: app.iconUrl,
          provider: this.name,
          sourceUrl: app.sourceUrl,
          latestVersion: app.version,
          variants: [
            {
              id: `${app.packageName}-${app.version}`,
              versionName: app.version || 'Latest',
              architecture: 'universal',
              packageType: 'APK',
              isBeta: false,
              releaseChannel: 'stable',
              downloadUrl: undefined,
            },
          ],
        };
      }

      const file = meta.file || {};
      const { isBeta, channel } = detectReleaseChannel(file.vername || '');
      const archStr = file.hardware?.cpus?.[0] || 'universal';
      const architecture = normalizeArch(archStr);

      const variant: AppVariant = {
        id: `${meta.package}-${file.vercode || file.vername || 'latest'}`,
        versionName: file.vername || 'Latest',
        versionCode: file.vercode,
        architecture,
        minAndroid: file.hardware?.sdk ? `Android SDK ${file.hardware.sdk}` : 'Android 5.0+',
        dpi: file.hardware?.densities?.length ? file.hardware.densities.join(', ') : 'nodpi',
        packageType: 'APK',
        fileSizeBytes: file.filesize,
        fileSizeFormatted: file.filesize ? formatBytes(file.filesize) : undefined,
        downloadUrl: file.path || file.path_alt,
        hashes: {
          md5: file.md5sum,
          sha1: file.signature?.sha1,
        },
        isBeta,
        releaseChannel: channel,
        releaseDate: file.added || meta.updated,
        metadata: {
          malwareRank: file.malware?.rank,
          signatureOwner: file.signature?.owner,
        },
      };

      return {
        id: meta.package,
        name: meta.name || cleanPkg,
        packageName: meta.package,
        developer: meta.developer?.name || meta.store?.name || 'Aptoide Developer',
        description: meta.media?.description || '',
        iconUrl: meta.icon || meta.graphic,
        provider: this.name,
        sourceUrl: `https://${meta.uname || meta.package}.en.aptoide.com/app`,
        latestVersion: file.vername || 'Latest',
        variants: [variant],
        permissions: file.used_permissions || [],
        screenshots: (meta.media?.screenshots || []).map((s: any) => s.url),
        rating: meta.stats?.rating?.avg ? Number(meta.stats.rating.avg.toFixed(1)) : undefined,
        downloads: meta.stats?.downloads || meta.stats?.pdownloads,
      };
    } catch (err: any) {
      throw new ProviderError(this.name, `Failed to retrieve app details: ${err.message}`, err);
    }
  }

  public override async resolveDownloadUrl(variant: AppVariant): Promise<string> {
    if (variant.downloadUrl) {
      return variant.downloadUrl;
    }
    const pkg = variant.id.split('-')[0];
    const details = await this.getAppDetails(pkg);
    if (details.variants[0]?.downloadUrl) {
      return details.variants[0].downloadUrl;
    }
    throw new ProviderError(this.name, `Could not resolve download URL for ${variant.id}`);
  }
}
