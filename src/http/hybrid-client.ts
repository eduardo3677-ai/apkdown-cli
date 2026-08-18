import { HttpClient, HttpRequestOptions, HttpResponse } from './client.js';
import { FetchClient } from './fetch-client.js';
import { CurlClient } from './curl-client.js';

export class HybridClient implements HttpClient {
  private fetchClient: FetchClient;
  private curlClient: CurlClient;

  // Domains known to require TLS fingerprinting / browser impersonation
  private cloudflareDomains = [
    'apkmirror.com',
    'apkpure.com',
    'apkpure.net',
    'apkcombo.com',
    'd.apkpure.com',
  ];

  constructor() {
    this.fetchClient = new FetchClient();
    this.curlClient = new CurlClient();
  }

  private shouldUseCurl(url: string, options?: HttpRequestOptions): boolean {
    if (options?.impersonate) return true;
    const lower = url.toLowerCase();
    return this.cloudflareDomains.some((d) => lower.includes(d));
  }

  public async request<T = any>(url: string, options: HttpRequestOptions = {}): Promise<HttpResponse<T>> {
    if (this.shouldUseCurl(url, options)) {
      try {
        return await this.curlClient.request<T>(url, options);
      } catch (curlErr) {
        // Fallback to fetch if curl bridge failed
        try {
          return await this.fetchClient.request<T>(url, options);
        } catch {
          throw curlErr;
        }
      }
    }

    try {
      const res = await this.fetchClient.request<T>(url, options);
      // If Cloudflare block detected (403 forbidden with cf challenge)
      if (res.status === 403 || res.status === 503) {
        return await this.curlClient.request<T>(url, { ...options, impersonate: 'safari_ios' });
      }
      return res;
    } catch (fetchErr: any) {
      // If fetch failed, try curl client
      try {
        return await this.curlClient.request<T>(url, { ...options, impersonate: 'safari_ios' });
      } catch {
        throw fetchErr;
      }
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
    if (this.shouldUseCurl(url, options)) {
      try {
        return await this.curlClient.downloadFile(url, destPath, options, onProgress);
      } catch {
        return await this.fetchClient.downloadFile(url, destPath, options, onProgress);
      }
    }

    try {
      return await this.fetchClient.downloadFile(url, destPath, options, onProgress);
    } catch {
      return await this.curlClient.downloadFile(url, destPath, options, onProgress);
    }
  }
}

export const defaultHttpClient = new HybridClient();
