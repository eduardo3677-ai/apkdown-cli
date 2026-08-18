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

export class APKComboProvider extends BaseProvider {
  public readonly name = 'apkcombo';
  public readonly displayName = 'APKCombo';
  public readonly description = 'Fast mirror with direct Cloudflare storage links, split APK support & multi-arch filtering';
  public readonly homepage = 'https://apkcombo.com';

  private baseUrl = 'https://apkcombo.com';

  public async search(query: string, options: ProviderSearchOptions = {}): Promise<AppSearchResult[]> {
    const url = `${this.baseUrl}/search/${encodeURIComponent(query)}`;

    try {
      const res = await this.http.get(url, {
        impersonate: 'safari_ios',
        headers: {
          Referer: this.baseUrl,
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      });

      const $ = cheerio.load(res.data);
      const results: AppSearchResult[] = [];

      $('a.l_item, a.item, .content-apps a, .list-apps a').each((_, elem) => {
        const item = $(elem);
        const href = item.attr('href');
        if (!href || href.includes('javascript') || !href.startsWith('/')) return;

        const title = item.find('.name, .title').first().text().trim();
        if (!title) return;

        const dev = item.find('.author, .developer').first().text().trim();
        const iconElem = item.find('img').first();
        const iconUrl = iconElem.attr('data-src') || iconElem.attr('src');

        const parts = href.replace(/^\//, '').replace(/\/$/, '').split('/');
        const pkg = parts[1] || parts[0];

        if (results.some((r) => r.sourceUrl === `${this.baseUrl}${href}`)) return;

        const itemText = item.text().replace(/\s+/g, ' ').trim();
        const verMatch = item.find('.ver, .version, .is-sub.is-bold').first().text().trim().match(/(\d+(\.\d+)+[a-zA-Z0-9.\-_]*)/) ||
          itemText.match(/(?:v|version\s*)?(\d+(\.\d+)+[a-zA-Z0-9.\-_]*)/i);
        const version = verMatch ? verMatch[1] : 'Latest';

        results.push({
          id: href,
          name: title,
          packageName: pkg,
          developer: dev || 'APKCombo Publisher',
          version,
          iconUrl: iconUrl?.startsWith('http') ? iconUrl : iconUrl ? `${this.baseUrl}${iconUrl}` : undefined,
          description: `${title} on APKCombo`,
          provider: this.name,
          sourceUrl: `${this.baseUrl}${href}`,
        });
      });

      return results.slice(0, options.limit || 15);
    } catch (err: any) {
      throw new ProviderError(this.name, `Search failed: ${err.message}`, err);
    }
  }

  public async getAppDetails(appIdOrHref: string): Promise<AppDetails> {
    let appSlug = appIdOrHref.trim();

    // If only a package name or keyword was passed
    if (!appSlug.startsWith('/') && !appSlug.startsWith('http')) {
      const searchRes = await this.search(appSlug, { limit: 3 });
      const match = searchRes.find(
        (r) => r.packageName.toLowerCase() === appSlug.toLowerCase() || r.id.toLowerCase().includes(appSlug.toLowerCase())
      ) || searchRes[0];

      if (match) {
        appSlug = match.id;
      } else {
        appSlug = `/${appSlug}/${appSlug}/`;
      }
    } else if (appSlug.startsWith('http')) {
      appSlug = appSlug.replace(this.baseUrl, '');
    }

    if (!appSlug.startsWith('/')) {
      appSlug = `/${appSlug}`;
    }

    const downloadPageUrl = `${this.baseUrl}${appSlug.replace(/\/$/, '')}/download/apk`;

    try {
      const res = await this.http.get(downloadPageUrl, {
        impersonate: 'safari_ios',
        headers: {
          Referer: this.baseUrl,
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      });

      const $ = cheerio.load(res.data);
      const title = $('h1').first().text().replace(/Download\s+/i, '').trim() || 'App';
      const dev = $('.author, .developer').first().text().trim();
      const iconUrl = $('.icon img, .app_icon img').first().attr('src');
      const description = $('.info p, .description').first().text().trim();

      const variants: AppVariant[] = [];

      $('a.variant, .file-list a').each((_, elem) => {
        const a = $(elem);
        const rawHref = a.attr('href');
        if (!rawHref) return;

        const variantNameText = a.find('.name, .vername, .variant-name').first().text().trim() || a.text().trim();
        const archText = a.find('.arch, .info, .spec').first().text().trim();

        const isXapk = variantNameText.toUpperCase().includes('XAPK') || rawHref.includes('xapk') || archText.toUpperCase().includes('XAPK');
        const packageType: PackageType = isXapk ? 'XAPK' : 'APK';

        const architecture = normalizeArch(archText || variantNameText);
        const verMatch = variantNameText.match(/(\d+(\.\d+)+[a-zA-Z0-9.\-_]*)/);
        const versionName = verMatch ? verMatch[1] : 'Latest';

        const codeMatch = archText.match(/\((\d+)\)/) || variantNameText.match(/\((\d+)\)/);
        const versionCode = codeMatch ? parseInt(codeMatch[1], 10) : undefined;

        const sizeMatch = (archText + ' ' + variantNameText).match(/(\d+(\.\d+)?\s*(MB|GB|KB))/i);
        const fileSizeFormatted = sizeMatch ? sizeMatch[0] : undefined;

        const minAndroidMatch = (archText + ' ' + variantNameText).match(/(Android\s*\d+(\.\d+)?\+?)/i);
        const minAndroid = minAndroidMatch ? minAndroidMatch[0] : 'Android 5.0+';

        const dpiMatch = (archText + ' ' + variantNameText).match(/(\d+\s*-\s*\d+dpi|nodpi|\d+dpi)/i);
        const dpi = dpiMatch ? dpiMatch[0] : 'nodpi';

        const { isBeta, channel } = detectReleaseChannel(versionName, `${variantNameText} ${archText}`);
        const fullDownloadUrl = rawHref.startsWith('http') ? rawHref : `${this.baseUrl}${rawHref}`;

        variants.push({
          id: `apkcombo-${architecture}-${versionCode || variants.length + 1}`,
          versionName,
          versionCode,
          architecture,
          packageType,
          minAndroid,
          dpi,
          fileSizeFormatted,
          downloadUrl: fullDownloadUrl,
          isBeta,
          releaseChannel: channel,
        });
      });

      const parts = appSlug.replace(/^\//, '').replace(/\/$/, '').split('/');
      const pkg = parts[1] || parts[0] || 'com.apkcombo.app';

      // Fallback variant if none parsed
      if (variants.length === 0) {
        variants.push({
          id: 'apkcombo-default',
          versionName: 'Latest',
          architecture: 'universal',
          packageType: 'APK',
          downloadUrl: `${this.baseUrl}${appSlug}`,
          isBeta: false,
          releaseChannel: 'stable',
        });
      }

      return {
        id: appSlug,
        name: title,
        packageName: pkg,
        developer: dev || 'APKCombo',
        description,
        iconUrl: iconUrl?.startsWith('http') ? iconUrl : iconUrl ? `${this.baseUrl}${iconUrl}` : undefined,
        provider: this.name,
        sourceUrl: `${this.baseUrl}${appSlug}`,
        latestVersion: variants[0]?.versionName || 'Latest',
        variants,
      };
    } catch (err: any) {
      throw new ProviderError(this.name, `Failed to retrieve app details: ${err.message}`, err);
    }
  }

  public override async resolveDownloadUrl(variant: AppVariant): Promise<string> {
    if (!variant.downloadUrl) {
      throw new ProviderError(this.name, `Missing download URL for variant ${variant.id}`);
    }

    // Direct Cloudflare storage URL
    if (variant.downloadUrl.includes('r2.cloudflarestorage.com')) {
      return variant.downloadUrl;
    }

    return variant.downloadUrl;
  }
}
