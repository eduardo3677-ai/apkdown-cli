import { BaseProvider } from './base.js';
import { AptoideProvider } from './aptoide.js';
import { APKMirrorProvider } from './apkmirror.js';
import { APKPureProvider } from './apkpure.js';
import { APKComboProvider } from './apkcombo.js';
import { FDroidProvider } from './fdroid.js';
import { IzzyOnDroidProvider } from './izzyondroid.js';
import { GitHubProvider } from './github.js';
import { AppGalleryProvider } from './appgallery.js';
import { AppSearchResult, SearchOptions } from '../core/types.js';
import { configManager } from '../core/config.js';
import { ApkDownError } from '../core/errors.js';

export class ProviderRegistry {
  private static instance: ProviderRegistry;
  private providers: Map<string, BaseProvider> = new Map();

  private constructor() {
    this.registerDefaults();
  }

  public static getInstance(): ProviderRegistry {
    if (!ProviderRegistry.instance) {
      ProviderRegistry.instance = new ProviderRegistry();
    }
    return ProviderRegistry.instance;
  }

  private registerDefaults(): void {
    this.register(new AptoideProvider());
    this.register(new APKMirrorProvider());
    this.register(new APKPureProvider());
    this.register(new APKComboProvider());
    this.register(new FDroidProvider());
    this.register(new IzzyOnDroidProvider());
    this.register(new GitHubProvider());
    this.register(new AppGalleryProvider());
  }

  public register(provider: BaseProvider): void {
    this.providers.set(provider.name.toLowerCase(), provider);
  }

  public get(name: string): BaseProvider | undefined {
    return this.providers.get(name.toLowerCase());
  }

  public getAll(): BaseProvider[] {
    return Array.from(this.providers.values());
  }

  public getEnabledProviders(): BaseProvider[] {
    const config = configManager.getAll();
    return this.getAll().filter((p) => {
      const enabled = (config.providers as Record<string, boolean>)[p.name];
      return enabled !== false;
    });
  }

  /**
   * Resolves list of active providers respecting includes, excludes, and config
   */
  public resolveActiveProviders(options: {
    provider?: string;
    excludeProviders?: string[];
    includeProviders?: string[];
  }): BaseProvider[] {
    const { provider, excludeProviders = [], includeProviders = [] } = options;
    const normalizedExcludes = new Set(excludeProviders.map((p) => p.toLowerCase().trim()));

    // 1. If explicit comma-separated or single provider specified
    if (provider && provider.toLowerCase() !== 'all') {
      const names = provider.split(',').map((p) => p.trim().toLowerCase()).filter(Boolean);
      const matched = names
        .map((n) => this.get(n))
        .filter((p): p is BaseProvider => p !== undefined && !normalizedExcludes.has(p.name));

      if (matched.length === 0) {
        throw new ApkDownError(`No valid active providers found for "${provider}"`, 'PROVIDER_NOT_FOUND');
      }
      return matched;
    }

    // 2. If includeProviders array is specified
    if (includeProviders.length > 0) {
      const normalizedIncludes = new Set(includeProviders.map((p) => p.toLowerCase().trim()));
      return this.getAll().filter((p) => normalizedIncludes.has(p.name) && !normalizedExcludes.has(p.name));
    }

    // 3. Default to all enabled providers minus exclusions
    return this.getEnabledProviders().filter((p) => !normalizedExcludes.has(p.name));
  }

  /**
   * Searches across selected or all active providers with exact match ranking and concurrency control
   */
  public async search(options: SearchOptions): Promise<AppSearchResult[]> {
    const { query, limit = 10, includeBeta = false, arch } = options;
    const targetProviders = this.resolveActiveProviders(options);

    const results: AppSearchResult[] = [];

    // Run parallel searches with Promise.allSettled
    const searchPromises = targetProviders.map(async (p) => {
      try {
        const res = await p.search(query, { limit, includeBeta, arch });
        return res;
      } catch {
        return [];
      }
    });

    const settled = await Promise.allSettled(searchPromises);
    for (const outcome of settled) {
      if (outcome.status === 'fulfilled') {
        results.push(...outcome.value);
      }
    }

    // Deduplicate and rank results with exact package matching
    return this.deduplicateAndRankResults(results, query);
  }

  private deduplicateAndRankResults(results: AppSearchResult[], query: string): AppSearchResult[] {
    const cleanQuery = query.toLowerCase().trim();
    const isPackageQuery = /^[a-zA-Z][a-zA-Z0-9_]*\.[a-zA-Z0-9_]+(\.[a-zA-Z0-9_]+)*$/.test(cleanQuery);

    const seen = new Set<string>();
    const unique: { item: AppSearchResult; score: number }[] = [];

    for (const r of results) {
      const key = `${r.packageName.toLowerCase()}::${r.provider}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const pkg = r.packageName.toLowerCase();
      const name = r.name.toLowerCase();
      const id = r.id.toLowerCase();
      let score = 0;

      // Filter out fake mod versions (e.g. 899.9999.9999 or >400)
      if (r.version) {
        const major = parseInt(r.version.split(/[\.-]/)[0], 10);
        if ((!isNaN(major) && major >= 400) || r.version.includes('9999')) {
          continue;
        }
      }

      if (isPackageQuery) {
        // When searching specifically for package ID (e.g. org.telegram.messenger)
        if (pkg === cleanQuery || id === cleanQuery) {
          score += 10000;
        } else if (pkg.startsWith(cleanQuery) || cleanQuery.startsWith(pkg)) {
          score += 5000;
        } else {
          // If user searched for exact package, drop completely unrelated apps (e.g. discord or forks)
          continue;
        }
      } else {
        // Friendly name query (e.g. telegram, spotify)
        if (name === cleanQuery) {
          score += 2000;
        } else if (name.startsWith(cleanQuery)) {
          score += 1000;
        } else if (name.includes(cleanQuery)) {
          score += 500;
        }

        if (pkg.includes(cleanQuery)) {
          score += 400;
        }

        // Slight bonus for verified / popular official apps
        if (r.downloads && String(r.downloads).includes('M+')) {
          score += 100;
        }
      }

      unique.push({ item: r, score });
    }

    // Sort descending by score
    unique.sort((a, b) => b.score - a.score);

    return unique.map((u) => u.item);
  }
}

export const providerRegistry = ProviderRegistry.getInstance();
