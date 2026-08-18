import { HttpClient, HttpRequestOptions, HttpResponse } from './client.js';
import { NativeTlsClient } from './tls-client.js';
import { FetchClient } from './fetch-client.js';

/**
 * Pure Node.js Hybrid Client combining Native TLS Impersonation (Chrome/Safari)
 * with Node Fetch, with zero external dependencies and zero external python binaries.
 */
export class HybridClient implements HttpClient {
  private tlsClient: NativeTlsClient;
  private fetchClient: FetchClient;

  // Domains requiring modern browser TLS ciphers / headers
  private tlsPreferredDomains = [
    'apkmirror.com',
    'apkpure.com',
    'apkpure.net',
    'apkcombo.com',
    'd.apkpure.com',
    'appimg-drcn.dbankcdn.com',
  ];

  constructor() {
    this.tlsClient = new NativeTlsClient();
    this.fetchClient = new FetchClient();
  }

  private isTlsPreferred(url: string, options?: HttpRequestOptions): boolean {
    if (options?.impersonate) return true;
    const lower = url.toLowerCase();
    return this.tlsPreferredDomains.some((d) => lower.includes(d));
  }

  public async request<T = any>(url: string, options: HttpRequestOptions = {}): Promise<HttpResponse<T>> {
    if (this.isTlsPreferred(url, options)) {
      try {
        return await this.tlsClient.request<T>(url, options);
      } catch (tlsErr) {
        // Fallback to fetch client if TLS client failed
        try {
          return await this.fetchClient.request<T>(url, options);
        } catch {
          throw tlsErr;
        }
      }
    }

    try {
      return await this.fetchClient.request<T>(url, options);
    } catch {
      return await this.tlsClient.request<T>(url, options);
    }
  }

  public async get<T = any>(url: string, options: HttpRequestOptions = {}): Promise<HttpResponse<T>> {
    return this.request<T>(url, { ...options, method: 'GET' });
  }

  public async post<T = any>(url: string, body?: any, options: HttpRequestOptions = {}): Promise<HttpResponse<T>> {
    return this.request<T>(url, { ...options, method: 'POST', body });
  }

  public async downloadFile(
    url: string,
    destPath: string,
    options: HttpRequestOptions = {},
    onProgress?: (bytesWritten: number, totalBytes: number) => void
  ): Promise<{ filePath: string; bytesWritten: number; totalBytes: number; finalUrl: string }> {
    try {
      return await this.tlsClient.downloadFile(url, destPath, options, onProgress);
    } catch {
      return await this.fetchClient.downloadFile(url, destPath, options, onProgress);
    }
  }
}

export const defaultHttpClient = new HybridClient();
