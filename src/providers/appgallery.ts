import { BaseProvider } from './base.js';
import {
  AppDetails,
  AppSearchResult,
  AppVariant,
  ProviderSearchOptions,
} from '../core/types.js';
import { ProviderError } from '../core/errors.js';

interface HuaweiToken {
  token: string;
  expiresAt: number;
}

export class AppGalleryProvider extends BaseProvider {
  public readonly name = 'appgallery';
  public readonly displayName = 'Huawei AppGallery';
  public readonly description = 'Huawei official app store with real-time API search and version metadata';
  public readonly homepage = 'https://appgallery.huawei.com';

  private apiBase = 'https://web-drcn.hispace.dbankcloud.cn';
  private tokenCache: HuaweiToken | null = null;

  /**
   * Fetches a JWT Interface-Code token required by Huawei's internal API.
   * Cached for 10 minutes.
   */
  private async getInterfaceCode(): Promise<string> {
    if (this.tokenCache && Date.now() < this.tokenCache.expiresAt) {
      return this.tokenCache.token;
    }

    try {
      const res = await this.http.get<any>(
        `${this.apiBase}/webedge/getInterfaceCode`,
        {
          headers: {
            Origin: 'https://appgallery.huawei.com',
            Referer: 'https://appgallery.huawei.com/',
          },
        }
      );

      let token = '';
      if (typeof res.data === 'string') {
        // The API returns a raw JWT string (sometimes JSON-quoted)
        token = res.data.replace(/^"|"$/g, '').trim();
      } else if (res.data?.interfaceCode) {
        token = res.data.interfaceCode;
      }

      if (!token) {
        throw new Error('Empty interface code response');
      }

      this.tokenCache = {
        token,
        expiresAt: Date.now() + 10 * 60 * 1000,
      };

      return token;
    } catch (err: any) {
      throw new ProviderError(this.name, `Failed to get Huawei Interface-Code: ${err.message}`, err);
    }
  }

  private async apiHeaders(): Promise<Record<string, string>> {
    const token = await this.getInterfaceCode();
    return {
      'Interface-Code': `${token}_${Date.now()}`,
      Origin: 'https://appgallery.huawei.com',
      Referer: 'https://appgallery.huawei.com/',
      Accept: 'application/json, text/plain, */*',
    };
  }

  public async search(query: string, options: ProviderSearchOptions = {}): Promise<AppSearchResult[]> {
    try {
      const headers = await this.apiHeaders();
      const res = await this.http.get<any>(
        `${this.apiBase}/uowap/index`,
        {
          params: {
            method: 'internal.completeSearchWord',
            serviceType: '20',
            keyword: query,
            zone: '',
            locale: 'en_US',
          },
          headers,
          responseType: 'json',
        }
      );

      const data = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
      if (!data || data.rtnCode !== 0) {
        return [];
      }

      const results: AppSearchResult[] = [];
      const isPackageQuery = /^[a-zA-Z][a-zA-Z0-9_]*\.[a-zA-Z0-9_]+(\.[a-zA-Z0-9_]+)*$/.test(query.trim());

      // The API returns an `app` object for the top result
      if (data.app && data.app.package) {
        const app = data.app;

        // Filter: if searching for exact package ID, only return exact matches
        if (isPackageQuery && app.package.toLowerCase() !== query.toLowerCase()) {
          return [];
        }

        const icon = app.icon && app.icon.startsWith('http') ? app.icon : undefined;

        results.push({
          id: app.id || app.package,
          name: app.name || app.package,
          packageName: app.package,
          developer: app.kindName || 'Huawei AppGallery',
          version: app.version || 'Latest',
          iconUrl: icon,
          description: app.memo || app.intro || `${app.name} on Huawei AppGallery`,
          provider: this.name,
          sourceUrl: `https://appgallery.huawei.com/app/${app.id || ''}`,
          downloads: app.downCountDesc || (app.downloads ? String(app.downloads) : undefined),
        });
      }

      return results.slice(0, options.limit || 10);
    } catch (err: any) {
      // Don't throw on search failures - just return empty
      return [];
    }
  }

  public async getAppDetails(appIdOrPackage: string): Promise<AppDetails> {
    let appId = appIdOrPackage.trim();

    // If a package name is provided, search for the Huawei App ID first
    if (appId.includes('.') && !appId.toUpperCase().startsWith('C')) {
      const searchResults = await this.search(appId, { limit: 1 });
      if (searchResults.length > 0 && searchResults[0].id) {
        appId = searchResults[0].id;
      } else {
        throw new ProviderError(this.name, `App "${appIdOrPackage}" not found on Huawei AppGallery`);
      }
    }

    try {
      const headers = await this.apiHeaders();
      const res = await this.http.get<any>(
        `${this.apiBase}/uowap/index`,
        {
          params: {
            method: 'internal.getTabDetail',
            serviceType: '20',
            reqPageNum: '1',
            uri: `app|${appId}`,
            maxResults: '25',
            locale: 'en_US',
            version: '10.0.0',
            zone: '',
          },
          headers,
          responseType: 'json',
        }
      );

      const data = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
      if (!data || data.rtnCode !== 0 || !data.layoutData) {
        throw new ProviderError(this.name, `Huawei API returned error for "${appId}"`);
      }

      // Merge data from multiple layout sections
      let name = '';
      let iconUrl = '';
      let packageName = '';
      let versionName = '';
      let sizeDesc = '';
      let fullSize: number | undefined = undefined;
      let releaseDate = '';
      let developer = 'Huawei AppGallery Developer';
      let sha256 = '';
      let description = '';
      let intro = '';
      let targetSDK: number | undefined = undefined;

      for (const layout of data.layoutData) {
        const layoutName = layout.layoutName;
        const items = layout.dataList || [];
        if (items.length === 0) continue;
        const item = items[0];

        switch (layoutName) {
          case 'detailheadcard':
            name = item.name || name;
            iconUrl = item.icoUri || iconUrl;
            intro = item.intro || intro;
            break;
          case 'detailhiddencard':
            packageName = item.package || packageName;
            versionName = item.versionName || versionName;
            sha256 = item.sha256 || sha256;
            targetSDK = item.targetSDK || targetSDK;
            break;
          case 'detailappinfocard':
            packageName = item.package || packageName;
            versionName = item.version || versionName;
            sizeDesc = item.sizeDesc || sizeDesc;
            fullSize = item.fullSize || fullSize;
            releaseDate = item.releaseDate || releaseDate;
            developer = item.developer || developer;
            break;
          case 'detaildesccard':
            description = item.content || item.desc || description;
            break;
        }
      }

      if (!packageName) {
        throw new ProviderError(this.name, `Could not extract package name for Huawei app "${appId}"`);
      }

      if (iconUrl && !iconUrl.startsWith('http')) {
        iconUrl = `https://appgallery.huawei.com${iconUrl.startsWith('/') ? iconUrl : '/' + iconUrl}`;
      }

      const webUrl = `https://appgallery.huawei.com/app/${appId}`;

      const variant: AppVariant = {
        id: `appgallery-${appId}`,
        versionName: versionName || 'Latest',
        architecture: 'universal',
        packageType: 'APK',
        fileSizeBytes: fullSize,
        fileSizeFormatted: sizeDesc || undefined,
        // Huawei doesn't expose direct download URLs from the web API
        downloadUrl: undefined,
        hashes: sha256 ? { sha256 } : undefined,
        isBeta: false,
        releaseChannel: 'stable',
        releaseDate: releaseDate || undefined,
        minAndroid: targetSDK ? `Android SDK ${targetSDK}` : undefined,
        metadata: {
          deepLink: `hiapplink://com.huawei.appmarket?appId=${appId}`,
          webUrl,
        },
      };

      return {
        id: appId,
        name: name || packageName,
        packageName,
        developer,
        description: description || intro || `${name} on Huawei AppGallery`,
        iconUrl: iconUrl || undefined,
        provider: this.name,
        sourceUrl: webUrl,
        latestVersion: versionName || 'Latest',
        variants: [variant],
      };
    } catch (err: any) {
      if (err instanceof ProviderError) throw err;
      throw new ProviderError(this.name, `Failed to retrieve Huawei AppGallery details: ${err.message}`, err);
    }
  }

  public override async resolveDownloadUrl(variant: AppVariant): Promise<string> {
    // Huawei AppGallery does not expose direct APK download URLs via web API.
    // Users need to install via the AppGallery app or use the deep link.
    const deepLink = variant.metadata?.deepLink;
    if (deepLink) {
      throw new ProviderError(
        this.name,
        `Huawei AppGallery requires the AppGallery app for downloads. Use deep link: ${deepLink}`
      );
    }
    throw new ProviderError(
      this.name,
      'Huawei AppGallery does not provide direct APK download URLs from the web API.'
    );
  }
}
