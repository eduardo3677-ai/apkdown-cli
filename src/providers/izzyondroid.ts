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

interface IzzyIndexPackage {
  metadata?: Record<string, any>;
  versions?: Record<string, any>;
}

interface IzzyIndex {
  packages?: Record<string, IzzyIndexPackage>;
}

export class IzzyOnDroidProvider extends BaseProvider {
  public readonly name = 'izzyondroid';
  public readonly displayName = 'IzzyOnDroid (F-Droid Repo)';
  public readonly description = 'Curated F-Droid third-party repository hosting 1,000+ independent open-source Android apps';
  public readonly homepage = 'https://apt.izzysoft.de/fdroid';
  public override readonly supportsVersionHistory = true;

  private baseUrl = 'https://apt.izzysoft.de/fdroid';
  private static indexCache: { data: IzzyIndex; expiresAt: number } | null = null;

  private async getIndex(): Promise<IzzyIndex> {
    if (IzzyOnDroidProvider.indexCache && Date.now() < IzzyOnDroidProvider.indexCache.expiresAt) {
      return IzzyOnDroidProvider.indexCache.data;
    }

    const res = await this.http.get<IzzyIndex>(`${this.baseUrl}/repo/index-v2.json`, {
      responseType: 'json',
      impersonate: 'safari_ios',
      headers: { Referer: this.baseUrl },
    });
    const data = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
    IzzyOnDroidProvider.indexCache = {
      data,
      expiresAt: Date.now() + 10 * 60 * 1000,
    };
    return data;
  }

  private localized(value: unknown): string {
    if (typeof value === 'string') return value;
    if (!value || typeof value !== 'object') return '';
    const entries = value as Record<string, string>;
    return entries['en-US'] || entries.en || Object.values(entries)[0] || '';
  }

  public async search(query: string, options: ProviderSearchOptions = {}): Promise<AppSearchResult[]> {
    const cleanQuery = query.trim();
    const qLower = cleanQuery.toLowerCase();
    const isPackageQuery = /^[a-zA-Z][a-zA-Z0-9_]*\.[a-zA-Z0-9_]+(\.[a-zA-Z0-9_]+)*$/.test(cleanQuery);

    try {
      const index = await this.getIndex();
      const results: AppSearchResult[] = [];

      for (const [packageName, pkg] of Object.entries(index.packages || {})) {
        const metadata = pkg.metadata || {};
        const name = this.localized(metadata.name) || packageName;
        const summary = this.localized(metadata.summary) || this.localized(metadata.description);

        if (isPackageQuery) {
          if (packageName.toLowerCase() !== qLower) continue;
        } else if (
          !packageName.toLowerCase().includes(qLower) &&
          !name.toLowerCase().includes(qLower) &&
          !summary.toLowerCase().includes(qLower)
        ) {
          continue;
        }

        const versions = Object.values(pkg.versions || {}).sort(
          (a: any, b: any) => (b.manifest?.versionCode || 0) - (a.manifest?.versionCode || 0)
        );
        const latest = versions[0] as any;
        const versionName = latest?.manifest?.versionName || 'Latest';
        const versionCode = latest?.manifest?.versionCode;
        const iconName = metadata.icon?.['en-US']?.name || metadata.icon?.en?.name || metadata.icon?.name;

        results.push({
          id: packageName,
          name,
          packageName,
          developer: metadata.authorName || 'IzzyOnDroid Contributor',
          version: versionName,
          versionId: versionCode != null ? String(versionCode) : versionName,
          iconUrl: iconName ? `${this.baseUrl}/repo${iconName.startsWith('/') ? iconName : `/${iconName}`}` : undefined,
          description: summary || `${name} on IzzyOnDroid`,
          provider: this.name,
          sourceUrl: `${this.baseUrl}/index/apk/${packageName}`,
          updatedAt: metadata.lastUpdated ? new Date(metadata.lastUpdated).toISOString() : undefined,
        });

        if (isPackageQuery) break;
      }

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

    if (!pkg.includes('.')) {
      const searchRes = await this.search(pkg, { limit: 1 });
      if (searchRes.length > 0) pkg = searchRes[0].packageName;
    }

    try {
      const index = await this.getIndex();
      const entry = index.packages?.[pkg];
      if (!entry) {
        throw new ProviderError(this.name, `App "${pkg}" not found on IzzyOnDroid`);
      }

      const metadata = entry.metadata || {};
      const versions = Object.entries(entry.versions || {}).sort(
        ([, a]: [string, any], [, b]: [string, any]) =>
          (b.manifest?.versionCode || 0) - (a.manifest?.versionCode || 0)
      );

      const variants: AppVariant[] = versions.map(([hash, version], idx) => {
        const manifest = version.manifest || {};
        const file = version.file || {};
        const versionName = manifest.versionName || `v${manifest.versionCode || idx + 1}`;
        const versionCode = manifest.versionCode;
        const architecture = normalizeArch((manifest.nativecode || []).join(', ') || 'universal');
        const { isBeta, channel } = detectReleaseChannel(versionName);
        const fileName = file.name || `/${pkg}_${versionCode}.apk`;

        return {
          id: `izzy-${pkg}-${versionCode || hash.slice(0, 12)}`,
          versionId: versionCode != null ? String(versionCode) : hash,
          releaseId: hash,
          versionName,
          versionCode,
          architecture,
          minAndroid: manifest.usesSdk?.minSdkVersion
            ? `Android SDK ${manifest.usesSdk.minSdkVersion}`
            : undefined,
          packageType: 'APK',
          fileSizeBytes: file.size,
          fileSizeFormatted: file.size ? formatBytes(file.size) : undefined,
          downloadUrl: `${this.baseUrl}/repo${fileName.startsWith('/') ? fileName : `/${fileName}`}`,
          hashes: { sha256: file.sha256 || hash },
          isBeta,
          releaseChannel: channel,
          releaseDate: version.added ? new Date(version.added).toISOString().split('T')[0] : undefined,
        };
      });

      if (variants.length === 0) {
        throw new ProviderError(this.name, `No APK downloads found for IzzyOnDroid app ${pkg}`);
      }

      const iconName = metadata.icon?.['en-US']?.name || metadata.icon?.en?.name || metadata.icon?.name;
      return {
        id: pkg,
        name: this.localized(metadata.name) || pkg,
        packageName: pkg,
        developer: metadata.authorName || 'IzzyOnDroid Open Source Community',
        description: this.localized(metadata.description) || this.localized(metadata.summary),
        iconUrl: iconName ? `${this.baseUrl}/repo${iconName.startsWith('/') ? iconName : `/${iconName}`}` : undefined,
        provider: this.name,
        sourceUrl: `${this.baseUrl}/index/apk/${pkg}`,
        latestVersion: variants[0]?.versionName || 'Latest',
        variants,
        hasVersionHistory: variants.length > 1,
      };
    } catch (err: any) {
      if (err instanceof ProviderError) throw err;
      throw new ProviderError(this.name, `Failed to retrieve app details: ${err.message}`, err);
    }
  }

  public override async resolveDownloadUrl(variant: AppVariant): Promise<string> {
    if (variant.downloadUrl) return variant.downloadUrl;
    throw new ProviderError(this.name, `Missing download URL for variant ${variant.id}`);
  }
}
