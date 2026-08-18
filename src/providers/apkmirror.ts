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

export class APKMirrorProvider extends BaseProvider {
  public readonly name = 'apkmirror';
  public readonly displayName = 'APKMirror';
  public readonly description = 'Extensive archive with alpha/beta/preview releases and multi-arch APK & bundle variants';
  public readonly homepage = 'https://www.apkmirror.com';

  private baseUrl = 'https://www.apkmirror.com';

  public async search(query: string, options: ProviderSearchOptions = {}): Promise<AppSearchResult[]> {
    const url = `${this.baseUrl}/?post_type=app_release&searchtype=apk&s=${encodeURIComponent(query)}`;

    try {
      const res = await this.http.get(url, {
        impersonate: 'safari_ios',
        headers: {
          Referer: 'https://www.apkmirror.com/',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      });

      const $ = cheerio.load(res.data);
      const results: AppSearchResult[] = [];

      $('.appRow').each((_, element) => {
        const row = $(element);
        const titleElem = row.find('.appRowTitle a.fontBlack, .appRowTitle a, a.fontBlack').first();
        const titleText = titleElem.text().trim();
        const link = titleElem.attr('href');

        if (!titleText || !link) return;

        const devElem = row.find('.byDeveloper, .byAppName, .byApp').first();
        const dev = devElem.text().replace(/^by\s+/i, '').trim();
        const dateElem = row.find('.dateyear_utc').first();
        const date = dateElem.text().trim();
        const iconElem = row.find('img.ellipsisText, img').first();
        const iconSrc = iconElem.attr('src') || iconElem.attr('data-src');

        const cleanLink = link.startsWith('http') ? link : `${this.baseUrl}${link}`;
        const parts = link.replace(/^\/apk\//, '').replace(/\/$/, '').split('/');
        const id = cleanLink;
        const pkgName = parts[1] || parts[0] || 'com.apkmirror.app';

        // Extract version from title if present
        const verMatch = titleText.match(/(\d+(\.\d+)+[a-zA-Z0-9.\-_]*)/);
        const version = verMatch ? verMatch[1] : undefined;

        let iconUrl: string | undefined = undefined;
        if (iconSrc) {
          if (iconSrc.includes('src=')) {
            const rawSrcMatch = iconSrc.match(/src=([^&]+)/);
            iconUrl = rawSrcMatch ? decodeURIComponent(rawSrcMatch[1]) : iconSrc;
          } else {
            iconUrl = iconSrc.startsWith('http') ? iconSrc : `${this.baseUrl}${iconSrc}`;
          }
        }

        // Deduplicate
        if (results.some((r) => r.sourceUrl === cleanLink)) return;

        results.push({
          id,
          name: titleText,
          packageName: pkgName,
          developer: dev || 'APKMirror Publisher',
          version: version || 'Latest',
          iconUrl,
          description: `${titleText} by ${dev || 'APKMirror'}`,
          provider: this.name,
          sourceUrl: cleanLink,
          updatedAt: date,
        });
      });

      return results.slice(0, options.limit || 15);
    } catch (err: any) {
      throw new ProviderError(this.name, `Search failed: ${err.message}`, err);
    }
  }

  public async getAppDetails(appIdOrUrl: string): Promise<AppDetails> {
    let appUrl = appIdOrUrl.trim();

    // If a package name or keyword was passed instead of a full URL
    if (!appUrl.startsWith('http')) {
      if (appUrl.startsWith('/apk/')) {
        appUrl = `${this.baseUrl}${appUrl}`;
      } else {
        const searchResults = await this.search(appUrl, { limit: 5 });
        if (searchResults.length === 0) {
          throw new ProviderError(this.name, `No APKMirror release found matching "${appUrl}"`);
        }
        appUrl = searchResults[0].sourceUrl || searchResults[0].id;
      }
    }

    try {
      const res = await this.http.get(appUrl, {
        impersonate: 'safari_ios',
        headers: {
          Referer: this.baseUrl,
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      });

      const $ = cheerio.load(res.data);
      const title = $('h1').first().text().trim() || 'APKMirror App';
      const dev = $('.byDeveloper, .byAppName, a.byApp').first().text().replace(/^by\s+/i, '').trim();
      const description = $('.notes, .app-notes, .description').first().text().trim();
      const iconElem = $('img.avatar, .app-icon img, img.ellipsisText').first();
      const iconSrc = iconElem.attr('src') || iconElem.attr('data-src');

      let iconUrl: string | undefined = undefined;
      if (iconSrc) {
        if (iconSrc.includes('src=')) {
          const rawSrcMatch = iconSrc.match(/src=([^&]+)/);
          iconUrl = rawSrcMatch ? decodeURIComponent(rawSrcMatch[1]) : iconSrc;
        } else {
          iconUrl = iconSrc.startsWith('http') ? iconSrc : `${this.baseUrl}${iconSrc}`;
        }
      }

      const variants: AppVariant[] = [];

      // Parse variant table rows specifically containing apk-download links
      $('.table-row').each((_, elem) => {
        const row = $(elem);
        const linkElem = row.find('a[href*="apk-download"], a[href*="download/"], a.accent_color').first();
        const href = linkElem.attr('href');
        if (!href || (!href.includes('apk-download') && !href.includes('download/'))) return;

        const cells = row.find('.table-cell');
        if (cells.length < 4) return;

        const varCell = $(cells[0]);
        const archCell = $(cells[1]);
        const minVerCell = $(cells[2]);
        const dpiCell = $(cells[3]);

        const varText = varCell.text().replace(/\s+/g, ' ').trim();
        if (varText.toLowerCase().includes('variant')) return;

        const isBundle = varText.toUpperCase().includes('BUNDLE') || href.includes('bundle');
        const packageType: PackageType = isBundle ? 'APKM' : 'APK';

        const archText = archCell.text().replace(/^Arch(itecture)?/i, '').trim();
        const architecture = normalizeArch(archText);

        const minAndroid = minVerCell.text().replace(/^Version(Minimum Version)?/i, '').trim() || 'Android 5.0+';
        const dpi = dpiCell.text().replace(/^DPI(Screen DPI)?/i, '').trim() || 'nodpi';

        const verMatch = varText.match(/(\d+(\.\d+)+[a-zA-Z0-9.\-_]*)/) || title.match(/(\d+(\.\d+)+[a-zA-Z0-9.\-_]*)/);
        const versionName = verMatch ? verMatch[1] : title;

        const codeMatch = varText.match(/\b(\d{5,10})\b/);
        const versionCode = codeMatch ? parseInt(codeMatch[1], 10) : undefined;

        const { isBeta, channel } = detectReleaseChannel(versionName, `${title} ${varText}`);
        const fullVariantUrl = href.startsWith('http') ? href : `${this.baseUrl}${href}`;

        variants.push({
          id: `apkmirror-${architecture}-${versionCode || variants.length + 1}`,
          versionName,
          versionCode,
          architecture,
          minAndroid,
          dpi,
          packageType,
          downloadToken: fullVariantUrl,
          isBeta,
          releaseChannel: channel,
        });
      });

      // If no variant table rows were found directly, this might be an app releases overview page
      if (variants.length === 0) {
        const firstReleaseLink = $('.listWidget .appRow').first().find('a.fontBlack, a.appRowTitle, .appRowTitle a').first().attr('href');
        if (firstReleaseLink) {
          const fullReleaseUrl = firstReleaseLink.startsWith('http') ? firstReleaseLink : `${this.baseUrl}${firstReleaseLink}`;
          return await this.getAppDetails(fullReleaseUrl);
        }

        // Default single variant fallback
        variants.push({
          id: 'apkmirror-default',
          versionName: 'Latest',
          architecture: 'universal',
          packageType: 'APK',
          downloadToken: appUrl,
          isBeta: false,
          releaseChannel: 'stable',
        });
      }

      const parts = appUrl.replace(/^\/apk\//, '').replace(/\/$/, '').split('/');
      const pkg = parts[1] || parts[0] || 'com.apkmirror.app';

      return {
        id: appUrl,
        name: title,
        packageName: pkg,
        developer: dev || 'APKMirror',
        description,
        iconUrl,
        provider: this.name,
        sourceUrl: appUrl,
        latestVersion: variants[0]?.versionName || 'Latest',
        variants,
      };
    } catch (err: any) {
      throw new ProviderError(this.name, `Failed to retrieve APKMirror app details: ${err.message}`, err);
    }
  }

  public override async resolveDownloadUrl(variant: AppVariant): Promise<string> {
    const step1Url = variant.downloadToken || variant.downloadUrl;
    if (!step1Url) {
      throw new ProviderError(this.name, 'Missing download token for APKMirror variant');
    }

    try {
      // Step 1: Request Variant page and extract Download Button link
      const r1 = await this.http.get(step1Url, {
        impersonate: 'safari_ios',
        headers: {
          Referer: this.baseUrl,
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      });

      const $1 = cheerio.load(r1.data);
      const btn1 = $1('a.downloadButton, a[href*="download/?key="], a.accent_bg').first();
      const href1 = btn1.attr('href');

      if (!href1) {
        // Check for direct download.php link
        const directPhp = $1('a[href*="download.php"]').first().attr('href');
        if (directPhp) {
          return directPhp.startsWith('http') ? directPhp : `${this.baseUrl}${directPhp}`;
        }
        throw new ProviderError(this.name, 'Could not find Step 1 download button on APKMirror');
      }

      const step2Url = href1.startsWith('http') ? href1 : `${this.baseUrl}${href1}`;

      // Step 2: Request interstitial download page and extract final download link
      const r2 = await this.http.get(step2Url, {
        impersonate: 'safari_ios',
        headers: {
          Referer: step1Url,
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      });

      const $2 = cheerio.load(r2.data);
      const btn2 = $2('a#download-link, a[href*="download.php"]').first();
      const href2 = btn2.attr('href');

      if (!href2) {
        throw new ProviderError(this.name, 'Could not resolve Step 2 download.php link on APKMirror');
      }

      const finalPhpUrl = href2.startsWith('http') ? href2 : `${this.baseUrl}${href2}`;
      return finalPhpUrl;
    } catch (err: any) {
      throw new ProviderError(this.name, `APKMirror download resolution failed: ${err.message}`, err);
    }
  }
}
