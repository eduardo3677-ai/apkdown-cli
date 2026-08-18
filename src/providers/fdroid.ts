import * as cheerio from 'cheerio';
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

export class FDroidProvider extends BaseProvider {
  public readonly name = 'fdroid';
  public readonly displayName = 'F-Droid (Free & Open Source)';
  public readonly description = 'Official repository for verified FOSS Android apps with verified source & SHA256 hashes';
  public readonly homepage = 'https://f-droid.org';

  private baseUrl = 'https://f-droid.org';
  private searchUrl = 'https://search.f-droid.org';

  public async search(query: string, options: ProviderSearchOptions = {}): Promise<AppSearchResult[]> {
    const url = `${this.searchUrl}/?q=${encodeURIComponent(query)}&lang=en`;

    try {
      const res = await this.http.get(url, { responseType: 'text' });
      const $ = cheerio.load(res.data);
      const results: AppSearchResult[] = [];

      $('.package-header').each((_, elem) => {
        const item = $(elem);
        const href = item.attr('href') || '';
        const pkgMatch = href.match(/packages\/([^/]+)/);
        const packageName = pkgMatch ? pkgMatch[1] : '';
        if (!packageName) return;

        const name = item.find('.package-name').first().text().trim() || packageName;
        const summary = item.find('.package-summary').first().text().trim();
        const iconElem = item.find('.package-icon').first();
        const iconUrl = iconElem.attr('src');

        results.push({
          id: packageName,
          name,
          packageName,
          developer: 'F-Droid FOSS Community',
          version: 'Latest',
          iconUrl,
          description: summary || `${name} on F-Droid`,
          provider: this.name,
          sourceUrl: href.startsWith('http') ? href : `${this.baseUrl}${href}`,
        });
      });

      return results.slice(0, options.limit || 15);
    } catch (err: any) {
      throw new ProviderError(this.name, `Search failed: ${err.message}`, err);
    }
  }

  public async getAppDetails(appIdOrPackage: string): Promise<AppDetails> {
    let pkg = appIdOrPackage.trim();

    // If query does not look like a package name (no dot), search first
    if (!pkg.includes('.')) {
      const searchRes = await this.search(pkg, { limit: 1 });
      if (searchRes.length > 0) {
        pkg = searchRes[0].packageName;
      }
    }

    const apiUrl = `${this.baseUrl}/api/v1/packages/${encodeURIComponent(pkg)}`;

    try {
      const res = await this.http.get(apiUrl, { responseType: 'json' });
      const data = res.data;

      if (!data || !data.packageName) {
        throw new ProviderError(this.name, `App "${pkg}" not found on F-Droid`);
      }

      const variants: AppVariant[] = (data.packages || []).map((p: any, idx: number): AppVariant => {
        const archStr = (p.nativecode && p.nativecode.length > 0) ? p.nativecode.join(', ') : 'universal';
        const architecture = normalizeArch(archStr);
        const versionName = p.versionName || `v${p.versionCode}`;
        const { isBeta, channel } = detectReleaseChannel(versionName);
        const apkFile = p.apkName || `${data.packageName}_${p.versionCode}.apk`;

        return {
          id: `fdroid-${architecture}-${p.versionCode || idx}`,
          versionName,
          versionCode: p.versionCode,
          architecture,
          minAndroid: p.minSdkVersion ? `Android SDK ${p.minSdkVersion}` : 'Android 5.0+',
          packageType: 'APK',
          fileSizeBytes: p.size,
          fileSizeFormatted: p.size ? formatBytes(p.size) : undefined,
          downloadUrl: `${this.baseUrl}/repo/${apkFile}`,
          hashes: {
            sha256: p.hash && p.hashType === 'sha256' ? p.hash : undefined,
          },
          isBeta,
          releaseChannel: channel,
          releaseDate: p.added ? new Date(p.added).toISOString().split('T')[0] : undefined,
        };
      });

      const appName = data.name || pkg.split('.').pop()?.replace(/^./, (str) => str.toUpperCase()) || pkg;

      return {
        id: data.packageName,
        name: appName,
        packageName: data.packageName,
        developer: data.authorName || 'F-Droid Author',
        description: data.summary || data.description || '',
        iconUrl: data.icon ? `${this.baseUrl}/repo/icons-640/${data.icon}` : undefined,
        provider: this.name,
        sourceUrl: `${this.baseUrl}/en/packages/${data.packageName}/`,
        latestVersion: variants[0]?.versionName || 'Latest',
        variants,
      };
    } catch (err: any) {
      throw new ProviderError(this.name, `Failed to fetch app details: ${err.message}`, err);
    }
  }

  public override async resolveDownloadUrl(variant: AppVariant): Promise<string> {
    if (variant.downloadUrl) {
      return variant.downloadUrl;
    }
    throw new ProviderError(this.name, `Missing download URL for variant ${variant.id}`);
  }
}
