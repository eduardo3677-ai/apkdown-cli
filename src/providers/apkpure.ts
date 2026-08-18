import * as cheerio from 'cheerio';
import { BaseProvider } from './base.js';
import {
  AppDetails,
  AppSearchResult,
  AppVariant,
  PackageType,
  ProviderSearchOptions,
} from '../core/types.js';
import { ProviderError } from '../core/errors.js';
import { detectReleaseChannel, normalizeArch } from '../utils/arch.js';

export class APKPureProvider extends BaseProvider {
  public readonly name = 'apkpure';
  public readonly displayName = 'APKPure';
  public readonly description = 'Popular repository supporting full APK & XAPK packages, split bundles, and version histories';
  public readonly homepage = 'https://apkpure.com';

  private baseUrl = 'https://apkpure.com';

  public async search(query: string, options: ProviderSearchOptions = {}): Promise<AppSearchResult[]> {
    const url = `${this.baseUrl}/search?q=${encodeURIComponent(query)}`;

    try {
      const res = await this.http.get(url, {
        impersonate: 'safari_ios',
        headers: {
          Referer: 'https://apkpure.com/',
        },
      });

      const $ = cheerio.load(res.data);
      const results: AppSearchResult[] = [];

      $('.search-res li, .search-result li, .apk_list li, a.dd, .apk-item').each((_, element) => {
        const item = $(element);
        const link = item.find('a').first().attr('href') || item.attr('href');
        if (!link || link.includes('javascript') || link.includes('/topic/') || link.includes('/campaign/')) return;

        const title = item.find('.title, .p1, .search-title, a.title').first().text().trim();
        if (!title) return;

        const dev = item.find('.developer, .p2, .author').first().text().trim();
        const iconElem = item.find('img').first();
        const iconUrl = iconElem.attr('data-original') || iconElem.attr('src');

        const cleanLink = link.startsWith('http') ? link : `${this.baseUrl}${link}`;
        const parts = link.replace(/\/$/, '').split('/');
        const pkg = parts[parts.length - 1] || title.toLowerCase().replace(/\s+/g, '.');

        // Ignore APKPure Aegon store app unless explicitly searched for
        if (pkg.includes('com.apkpure.aegon') && !query.toLowerCase().includes('apkpure')) {
          return;
        }

        // Check if already added
        if (results.some((r) => r.packageName === pkg)) return;

        results.push({
          id: cleanLink,
          name: title,
          packageName: pkg,
          developer: dev || 'APKPure Dev',
          version: 'Latest',
          iconUrl,
          description: `${title} on APKPure`,
          provider: this.name,
          sourceUrl: cleanLink,
        });
      });

      return results.slice(0, options.limit || 15);
    } catch (err: any) {
      throw new ProviderError(this.name, `Search failed: ${err.message}`, err);
    }
  }

  public async getAppDetails(appIdOrPackage: string): Promise<AppDetails> {
    let appUrl = appIdOrPackage.trim();
    let pkg = appIdOrPackage.trim();

    // If only a package name was passed without full URL path
    if (!appUrl.startsWith('http') && !appUrl.includes('/')) {
      const searchRes = await this.search(appUrl, { limit: 5 });
      const match = searchRes.find(
        (r) =>
          !r.packageName.includes('com.apkpure.aegon') &&
          (r.packageName.toLowerCase() === appUrl.toLowerCase() || r.id.toLowerCase().includes(appUrl.toLowerCase()))
      ) || searchRes[0];

      if (match && match.sourceUrl) {
        appUrl = match.sourceUrl;
        pkg = match.packageName;
      } else {
        appUrl = `${this.baseUrl}/${appUrl}/${appUrl}`;
      }
    } else if (appUrl.startsWith('http')) {
      const parts = appUrl.replace(/\/$/, '').split('/');
      pkg = parts[parts.length - 1];
    } else {
      const parts = appUrl.replace(/\/$/, '').split('/');
      pkg = parts[parts.length - 1];
      appUrl = `${this.baseUrl}/${appUrl.replace(/^\//, '')}`;
    }

    try {
      // 1. Fetch main app page to get metadata (Title, Developer, Icon, Description)
      const mainRes = await this.http.get(appUrl, {
        impersonate: 'safari_ios',
        headers: { Referer: this.baseUrl },
      });

      const $ = cheerio.load(mainRes.data);
      let title = $('h1').first().text().replace(/Download\s+/i, '').trim();
      if (!title || title.toLowerCase().includes("page can't be found")) {
        title = pkg;
      }

      const dev = $('.developer, .author, .details-author, .info .p2').first().text().trim();
      const iconUrl = $('.icon img, .app_icon img, .app-icon img, .details_sdk img').first().attr('src');
      const description = $('.describe, .description, .details-info').first().text().trim();

      const variants: AppVariant[] = [];

      // 2. Fetch the /download page if available to extract specific architecture splits & versions
      try {
        const downloadPageUrl = appUrl.endsWith('/download') ? appUrl : `${appUrl}/download`;
        const dlRes = await this.http.get(downloadPageUrl, {
          impersonate: 'safari_ios',
          headers: { Referer: appUrl },
        });

        const $dl = cheerio.load(dlRes.data);

        $dl('a').each((_, elem) => {
          const a = $dl(elem);
          const href = a.attr('href') || '';

          if (href.includes('d.apkpure.com/b/')) {
            if (href.includes('com.apkpure.aegon') && !pkg.includes('com.apkpure.aegon')) {
              return;
            }

            const isXapk = href.includes('/XAPK/') || a.text().toUpperCase().includes('XAPK');
            const packageType: PackageType = isXapk ? 'XAPK' : 'APK';

            const archMatch = href.match(/nc=([^&]+)/);
            const archStr = archMatch ? decodeURIComponent(archMatch[1]) : 'universal';
            const architecture = normalizeArch(archStr);

            const codeMatch = href.match(/versionCode=(\d+)/);
            const versionCode = codeMatch ? parseInt(codeMatch[1], 10) : undefined;

            const sdkMatch = href.match(/sv=(\d+)/);
            const minAndroid = sdkMatch ? `Android ${this.sdkToAndroidVersion(parseInt(sdkMatch[1], 10))}+` : 'Android 5.0+';

            const linkText = a.text().trim();
            const verMatch = linkText.match(/(\d+(\.\d+)+[a-zA-Z0-9.\-_]*)/);
            const versionName = verMatch ? verMatch[1] : 'Latest';

            const sizeMatch = linkText.match(/(\d+(\.\d+)?\s*(MB|GB|KB))/i);
            const fileSizeFormatted = sizeMatch ? sizeMatch[0] : undefined;

            const { isBeta, channel } = detectReleaseChannel(versionName, linkText);
            const fullDownloadUrl = href.startsWith('http') ? href : `${this.baseUrl}${href}`;

            const variantId = `apkpure-${packageType.toLowerCase()}-${architecture}-${versionCode || variants.length + 1}`;

            if (!variants.some((v) => v.downloadUrl === fullDownloadUrl)) {
              variants.push({
                id: variantId,
                versionName,
                versionCode,
                architecture,
                packageType,
                minAndroid,
                fileSizeFormatted,
                downloadUrl: fullDownloadUrl,
                isBeta,
                releaseChannel: channel,
              });
            }
          }
        });
      } catch {
        // Download page might not exist for some apps
      }

      // 3. Add default direct APK & XAPK variants
      if (variants.length === 0) {
        variants.push({
          id: `apkpure-latest-apk`,
          versionName: 'Latest',
          architecture: 'universal',
          packageType: 'APK',
          downloadUrl: `https://d.apkpure.com/b/APK/${pkg}?version=latest`,
          isBeta: false,
          releaseChannel: 'stable',
        });
        variants.push({
          id: `apkpure-latest-xapk`,
          versionName: 'Latest (Bundle)',
          architecture: 'universal',
          packageType: 'XAPK',
          downloadUrl: `https://d.apkpure.com/b/XAPK/${pkg}?version=latest`,
          isBeta: false,
          releaseChannel: 'stable',
        });
      }

      return {
        id: appUrl,
        name: title,
        packageName: pkg,
        developer: dev || 'APKPure',
        description,
        iconUrl,
        provider: this.name,
        sourceUrl: appUrl,
        latestVersion: variants[0]?.versionName || 'Latest',
        variants,
      };
    } catch (err: any) {
      throw new ProviderError(this.name, `Failed to retrieve app details: ${err.message}`, err);
    }
  }

  public override async resolveDownloadUrl(variant: AppVariant): Promise<string> {
    if (variant.downloadUrl) {
      return variant.downloadUrl;
    }
    throw new ProviderError(this.name, `Missing download URL for variant ${variant.id}`);
  }

  private sdkToAndroidVersion(sdk: number): string {
    const sdkMap: Record<number, string> = {
      21: '5.0',
      22: '5.1',
      23: '6.0',
      24: '7.0',
      25: '7.1',
      26: '8.0',
      27: '8.1',
      28: '9.0',
      29: '10.0',
      30: '11.0',
      31: '12.0',
      32: '12L',
      33: '13.0',
      34: '14.0',
      35: '15.0',
    };
    return sdkMap[sdk] || `${sdk}`;
  }
}
