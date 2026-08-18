import {
  AppDetails,
  AppSearchResult,
  AppVariant,
  ProviderSearchOptions,
} from '../core/types.js';
import { HttpClient } from '../http/client.js';
import { defaultHttpClient } from '../http/hybrid-client.js';

export abstract class BaseProvider {
  /** Unique provider identifier (e.g. 'aptoide', 'apkmirror') */
  public abstract readonly name: string;
  
  /** Friendly display name */
  public abstract readonly displayName: string;

  /** Description of the provider source */
  public abstract readonly description: string;

  /** Homepage URL */
  public abstract readonly homepage: string;

  /** Whether this provider supports Beta / Insider / Preview versions */
  public readonly supportsBeta: boolean = true;

  /** Whether this provider exposes architecture-specific variants */
  public readonly supportsArchFiltering: boolean = true;

  protected http: HttpClient;

  constructor(httpClient: HttpClient = defaultHttpClient) {
    this.http = httpClient;
  }

  /**
   * Searches for applications matching the query string
   */
  public abstract search(
    query: string,
    options?: ProviderSearchOptions
  ): Promise<AppSearchResult[]>;

  /**
   * Retrieves full application details including all available variants
   */
  public abstract getAppDetails(appIdOrPackage: string): Promise<AppDetails>;

  /**
   * Resolves the final direct download URL for a given variant
   */
  public async resolveDownloadUrl(variant: AppVariant): Promise<string> {
    if (variant.downloadUrl) {
      return variant.downloadUrl;
    }
    throw new Error(`Provider ${this.name} could not resolve download URL for variant ${variant.id}`);
  }

  /**
   * Tests if the provider is reachable
   */
  public async isAvailable(): Promise<boolean> {
    try {
      const results = await this.search('telegram', { limit: 1 });
      return results.length > 0;
    } catch {
      return false;
    }
  }
}
