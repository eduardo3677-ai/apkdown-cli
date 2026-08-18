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
   * Searches across selected or all active providers with concurrency control
   */
  public async search(options: SearchOptions): Promise<AppSearchResult[]> {
    const { query, provider, limit = 10, includeBeta = false, arch } = options;

    if (provider && provider.toLowerCase() !== 'all') {
      const target = this.get(provider);
      if (!target) {
        throw new ApkDownError(`Unknown provider: "${provider}"`, 'PROVIDER_NOT_FOUND');
      }
      return await target.search(query, { limit, includeBeta, arch });
    }

    const enabled = this.getEnabledProviders();
    const results: AppSearchResult[] = [];

    // Run parallel searches with Promise.allSettled
    const searchPromises = enabled.map(async (p) => {
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

    // Deduplicate and rank results
    return this.deduplicateResults(results);
  }

  private deduplicateResults(results: AppSearchResult[]): AppSearchResult[] {
    const seen = new Set<string>();
    const unique: AppSearchResult[] = [];

    for (const r of results) {
      const key = `${r.packageName.toLowerCase()}::${r.provider}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(r);
      }
    }

    return unique;
  }
}

export const providerRegistry = ProviderRegistry.getInstance();
