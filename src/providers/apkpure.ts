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
  public override readonly supportsVersionHistory = true;

  private baseUrl = 'https://apkpure.com';
  private mobileUrl = 'https://m.apkpure.com';

  private badKeywords = [
    'login', 'register', 'howto', 'news', 'reviews', 'about', 'privacy',
    'terms', 'support', 'topics', 'install', 'verification', 'monetization',
    'search', 'cooperation', 'eu-amau', 'copyright', 'feedback'
  ];

  private tlds = ['.com', '.ai', '.io', '.net', '.org', '.html', '.htm', '.php', '.js', '.css'];

  public async search(query: string, options: ProviderSearchOptions = {}): Promise<AppSearchResult[]> {
    const url = `${this.mobileUrl}/search?q=${encodeURIComponent(query)}`;

    try {
      const res = await this.http.get(url, {
        impersonate: 'safari_ios',
        headers: {
          Referer: 'https://m.apkpure.com/',
        },
      });

      const $ = cheerio.load(res.data);
      const results: AppSearchResult[] = [];

      const isPackageQuery = /^[a-zA-Z][a-zA-Z0-9_]*\.[a-zA-Z0-9_]+(\.[a-zA-Z0-9_]+)*$/.test(query);
      const lowerQuery = query.toLowerCase();

      $('a').each((_, element) => {
        const a = $(element);
        const href = a.attr('href') || '';
        if (!href || href.includes('javascript')) return;

        const cleanHref = href.toLowerCase();
        if (this.badKeywords.some((k) => cleanHref.includes(`/${k}`) || cleanHref.endsWith(`/${k}`))) {
          return;
        }

        // Match APKPure app pages with real Android package IDs (e.g. https://apkpure.com/telegram/org.telegram.messenger)
        const parts = href.split('?')[0].replace(/\/$/, '').split('/');
        const pkg = parts[parts.length - 1];
        if (
          !pkg ||
          pkg.includes('apkpure') ||
          this.badKeywords.includes(pkg) ||
          this.tlds.some((t) => pkg.toLowerCase().endsWith(t)) ||
          !/^[a-zA-Z][a-zA-Z0-9_]*\.[a-zA-Z0-9_]+(\.[a-zA-Z0-9_]+)*$/.test(pkg)
        ) {
          return;
        }

        if (isPackageQuery) {
          const lowerPkg = pkg.toLowerCase();
          if (lowerPkg !== lowerQuery) {
            return;
          }
        }

        const cleanLink = href.startsWith('http') ? href : `${this.baseUrl}${href}`;

        // Ignore APKPure Aegon store app unless explicitly searched for
        if (pkg.includes('com.apkpure.aegon') && !query.toLowerCase().includes('apkpure')) {
          return;
        }

        if (results.some((r) => r.packageName === pkg || r.sourceUrl === cleanLink)) return;

        const fullText = a.text().replace(/\s+/g, ' ').trim();
        let title = a.find('.title, .name, h3, h4, p').first().text().trim();
        if (!title && fullText) {
          title = fullText.split(' ')[0] || pkg;
        }
        if (!title || title.length < 2 || title.toLowerCase() === 'apkpure.com') return;

        const dev = a.find('.developer, .author, .p2').first().text().trim() || 'APKPure Developer';
        const iconElem = a.find('img').first();
        const iconUrl = iconElem.attr('data-original') || iconElem.attr('src');

        // Extract clean numerical version (avoid capturing rating numbers like 8.5)
        const verMatch = fullText.match(/\b(?:v|version\s*)(\d+(\.\d+)+[a-zA-Z0-9.\-_]*)\b/i) ||
          fullText.match(/\b(\d+\.\d+\.\d+[a-zA-Z0-9.\-_]*)\b/i);
        const resolvedVer = verMatch ? verMatch[1] : 'Latest';

        results.push({
          id: cleanLink,
          name: title,
          packageName: pkg,
          developer: dev,
          version: resolvedVer,
          iconUrl,
          description: `${title} on APKPure`,
          provider: this.name,
          sourceUrl: cleanLink,
        });
      });

      if (!isPackageQuery) {
        results.sort((a, b) => {
          const aPkgMatch = a.packageName.toLowerCase() === lowerQuery ? 1 : 0;
          const bPkgMatch = b.packageName.toLowerCase() === lowerQuery ? 1 : 0;
          return bPkgMatch - aPkgMatch;
        });
      }

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
      const isPackageId = /^[a-zA-Z][a-zA-Z0-9_]*\.[a-zA-Z0-9_]+(\.[a-zA-Z0-9_]+)*$/.test(appUrl);
      const exactMatch = searchRes.find(
        (r) =>
          !r.packageName.includes('com.apkpure.aegon') &&
          r.packageName.toLowerCase() === appUrl.toLowerCase()
      );
      const match = exactMatch || (isPackageId ? undefined : searchRes[0]);

      if (match && match.sourceUrl) {
        appUrl = match.sourceUrl;
        pkg = match.packageName;
      } else {
        throw new ProviderError(this.name, `App "${appIdOrPackage}" not found on APKPure`);
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

      // APKPure exposes the authoritative version fields in window.apkpure.pageData.
      const pageDataText = $('script').toArray().map((node) => $(node).html() || '').find((text) => text.includes('window.apkpure') && text.includes('\"versionName\"')) || '';
      const pageVersionMatch = pageDataText.match(/\"versionName\":\"([^\"]+)\"/);
      const pageVersionCodeMatch = pageDataText.match(/\"versionCode\":(\d+)/);
      const detectedVersion = pageVersionMatch?.[1] || 'Latest';
      const detectedVersionCode = pageVersionCodeMatch ? parseInt(pageVersionCodeMatch[1], 10) : undefined;

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
            const verMatch = versionCode != null
              ? linkText.match(/(\d+(\.\d+)+[a-zA-Z0-9.\-_]*)/)
              : null;
            const versionName = verMatch ? verMatch[1] : detectedVersion;

            const sizeMatch = linkText.match(/(\d+(\.\d+)?\s*(MB|GB|KB))/i);
            const fileSizeFormatted = sizeMatch ? sizeMatch[0] : undefined;

            const { isBeta, channel } = detectReleaseChannel(versionName, linkText);
            const fullDownloadUrl = href.startsWith('http') ? href : `${this.baseUrl}${href}`;

            const effectiveVersionCode = versionCode ?? detectedVersionCode;
            const variantId = `apkpure-${packageType.toLowerCase()}-${architecture}-${effectiveVersionCode || variants.length + 1}`;

            if (!variants.some((v) => v.downloadUrl === fullDownloadUrl)) {
              variants.push({
                id: variantId,
                versionId: effectiveVersionCode != null ? String(effectiveVersionCode) : versionName,
                releaseId: effectiveVersionCode != null ? String(effectiveVersionCode) : versionName,
                versionName,
                versionCode: effectiveVersionCode,
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
          versionId: detectedVersionCode != null ? String(detectedVersionCode) : detectedVersion,
          releaseId: detectedVersionCode != null ? String(detectedVersionCode) : detectedVersion,
          versionName: detectedVersion,
          architecture: 'universal',
          packageType: 'APK',
          downloadUrl: `https://d.apkpure.com/b/APK/${pkg}?version=latest`,
          isBeta: false,
          releaseChannel: 'stable',
        });
        variants.push({
          id: `apkpure-latest-xapk`,
          versionId: detectedVersionCode != null ? String(detectedVersionCode) : detectedVersion,
          releaseId: detectedVersionCode != null ? String(detectedVersionCode) : detectedVersion,
          versionName: `${detectedVersion} (Bundle)`,
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
        latestVersion: detectedVersion !== 'Latest' ? detectedVersion : (variants[0]?.versionName || detectedVersion),
        variants,
      };
    } catch (err: any) {
      throw new ProviderError(this.name, `Failed to retrieve app details: ${err.message}`, err);
    }
  }

  public override async getVersionHistory(appIdOrPackage: string): Promise<AppDetails> {
    let appUrl = appIdOrPackage.trim();
    if (!appUrl.startsWith('http')) {
      const results = await this.search(appUrl, { limit: 10 });
      const exact = results.find((result) => result.packageName.toLowerCase() === appUrl.toLowerCase());
      if (!exact?.sourceUrl) {
        throw new ProviderError(this.name, `App "${appIdOrPackage}" not found on APKPure`);
      }
      appUrl = exact.sourceUrl;
    }

    const baseDetails = await this.getAppDetails(appUrl);
    const historyUrl = `${appUrl.replace(/\/$/, '')}/versions`;
    try {
      const res = await this.http.get(historyUrl, {
        impersonate: 'safari_ios',
        headers: { Referer: appUrl },
      });
      const $ = cheerio.load(res.data);
      const variants: AppVariant[] = [];

      $('.ver_download_link[data-dt-versioncode]').each((_, element) => {
        const row = $(element);
        const versionName = row.attr('data-dt-version')?.trim();
        const versionCodeText = row.attr('data-dt-versioncode');
        const versionCode = versionCodeText ? parseInt(versionCodeText, 10) : undefined;
        if (!versionName || versionCode == null || Number.isNaN(versionCode)) return;

        const apkId = row.attr('data-dt-apkid') || '';
        const packageType: PackageType = apkId.includes('/XAPK/') ? 'XAPK' : 'APK';
        const fileSizeBytes = parseInt(row.attr('data-dt-filesize') || '', 10) || undefined;
        const text = row.text().replace(/\s+/g, ' ').trim();
        const dateMatch = text.match(/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},\s+\d{4}\b/);
        const { isBeta, channel } = detectReleaseChannel(versionName, text);

        if (variants.some((variant) => variant.versionCode === versionCode)) return;
        variants.push({
          id: `apkpure-history-${versionCode}`,
          versionId: String(versionCode),
          releaseId: apkId || String(versionCode),
          versionName,
          versionCode,
          architecture: 'universal',
          packageType,
          fileSizeBytes,
          fileSizeFormatted: fileSizeBytes ? `${(fileSizeBytes / 1024 / 1024).toFixed(1)} MB` : undefined,
          downloadUrl: `https://d.apkpure.com/b/${packageType}/${baseDetails.packageName}?versionCode=${versionCode}`,
          isBeta,
          releaseChannel: channel,
          releaseDate: dateMatch?.[0],
          metadata: {
            apkId,
            hasBuildVariants: row.attr('data-dt-variant') === 'true',
            variantIds: (row.attr('data-dt-apklist') || '').split(',').filter(Boolean),
          },
        });
      });

      if (variants.length === 0) return baseDetails;
      variants.sort((a, b) => (b.versionCode || 0) - (a.versionCode || 0));
      return {
        ...baseDetails,
        latestVersion: variants[0].versionName,
        variants,
        hasVersionHistory: variants.length > 1,
      };
    } catch (err: any) {
      if (err instanceof ProviderError) throw err;
      throw new ProviderError(this.name, `Failed to retrieve APKPure version history: ${err.message}`, err);
    }
  }

  public override async resolveDownloadUrl(variant: AppVariant): Promise<string> {
    if (!variant.downloadUrl) {
      throw new ProviderError(this.name, `Missing download URL for variant ${variant.id}`);
    }
    if (variant.downloadUrl.includes('d.apkpure.com/')) {
      try {
        const response = await this.http.get(variant.downloadUrl, {
          allowRedirects: false,
          responseType: 'buffer',
          headers: { Referer: this.baseUrl },
        });
        return response.headers.location || variant.downloadUrl;
      } catch {
        return variant.downloadUrl;
      }
    }
    return variant.downloadUrl;
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
