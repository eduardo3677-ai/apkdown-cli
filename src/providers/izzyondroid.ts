import * as cheerio from 'cheerio';
import { BaseProvider } from './base.js';
import {
  AppDetails,
  AppSearchResult,
  AppVariant,
  ProviderSearchOptions,
} from '../core/types.js';
import { ProviderError } from '../core/errors.js';
import { detectReleaseChannel, normalizeArch } from '../utils/arch.js';

export class IzzyOnDroidProvider extends BaseProvider {
  public readonly name = 'izzyondroid';
  public readonly displayName = 'IzzyOnDroid (F-Droid Repo)';
  public readonly description = 'Curated F-Droid third-party repository hosting 1,000+ independent open-source Android apps';
  public readonly homepage = 'https://apt.izzysoft.de/fdroid';

  private baseUrl = 'https://apt.izzysoft.de/fdroid';

  public async search(query: string, options: ProviderSearchOptions = {}): Promise<AppSearchResult[]> {
    const qLower = query.toLowerCase().trim();
    const url = `${this.baseUrl}/index.php?repo=iod&search=${encodeURIComponent(query)}`;

    try {
      const res = await this.http.get(url, {
        impersonate: 'safari_ios',
        headers: {
          Referer: this.baseUrl,
        },
      });

      const $ = cheerio.load(res.data);
      const results: AppSearchResult[] = [];

      $('.appdetailinner').each((_, elem) => {
        const box = $(elem);
        const nameElem = box.find('.boldname').first();
        const name = nameElem.text().trim();
        if (!name) return;

        const detailLink = box.find('a[href*="index/apk/"]').first();
        const href = detailLink.attr('href');
        if (!href) return;

        const pkg = href.split('index/apk/').pop() || '';
        if (!pkg) return;

        const verElem = box.find('.minor-details').first();
        const verText = verElem.text().trim();
        const version = verText.includes('/') ? verText.split('/')[0].trim() : verText;

        const descElem = box.find('.appdetailrow').eq(1).find('.appdetailcell').first();
        const description = descElem.text().trim() || `${name} on IzzyOnDroid`;

        // If query filter
        if (
          !qLower ||
          name.toLowerCase().includes(qLower) ||
          pkg.toLowerCase().includes(qLower) ||
          description.toLowerCase().includes(qLower)
        ) {
          results.push({
            id: pkg,
            name,
            packageName: pkg,
            developer: 'IzzyOnDroid Contributor',
            version: version || 'Latest',
            description,
            provider: this.name,
            sourceUrl: `${this.baseUrl}/index/apk/${pkg}`,
          });
        }
      });

      return results.slice(0, options.limit || 15);
    } catch (err: any) {
      throw new ProviderError(this.name, `Search failed: ${err.message}`, err);
    }
  }

  public async getAppDetails(appIdOrPackage: string): Promise<AppDetails> {
    let pkg = appIdOrPackage.trim();
    if (pkg.includes('index/apk/')) {
      pkg = pkg.split('index/apk/').pop() || pkg;
    }

    // If query does not look like a package name, search first
    if (!pkg.includes('.')) {
      const searchRes = await this.search(pkg, { limit: 1 });
      if (searchRes.length > 0) {
        pkg = searchRes[0].packageName;
      }
    }

    const appUrl = `${this.baseUrl}/index/apk/${encodeURIComponent(pkg)}`;

    try {
      const res = await this.http.get(appUrl, {
        impersonate: 'safari_ios',
        headers: {
          Referer: this.baseUrl,
        },
      });

      const $ = cheerio.load(res.data);
      const title = $('h2').first().text().trim() || pkg;
      const desc = $('.desc, .description, p').first().text().trim();

      const variants: AppVariant[] = [];

      $('a[href*="repo/"]').each((_, elem) => {
        const a = $(elem);
        const href = a.attr('href');
        if (!href || !href.endsWith('.apk')) return;

        const fullDlUrl = href.startsWith('http') ? href : href.startsWith('/') ? `https://apt.izzysoft.de${href}` : `${this.baseUrl}/${href}`;

        const fileMatch = href.match(/_(\d+)\.apk$/);
        const versionCode = fileMatch ? parseInt(fileMatch[1], 10) : undefined;
        const versionName = versionCode ? `v${versionCode}` : 'Latest';

        const { isBeta, channel } = detectReleaseChannel(versionName);

        if (!variants.some((v) => v.downloadUrl === fullDlUrl)) {
          variants.push({
            id: `izzy-${pkg}-${versionCode || variants.length + 1}`,
            versionName,
            versionCode,
            architecture: 'universal',
            packageType: 'APK',
            downloadUrl: fullDlUrl,
            isBeta,
            releaseChannel: channel,
          });
        }
      });

      if (variants.length === 0) {
        throw new ProviderError(this.name, `No APK downloads found for IzzyOnDroid app ${pkg}`);
      }

      return {
        id: pkg,
        name: title,
        packageName: pkg,
        developer: 'IzzyOnDroid Open Source Community',
        description: desc || `IzzyOnDroid package ${pkg}`,
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
}
