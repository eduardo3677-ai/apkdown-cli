import { HttpClient, HttpRequestOptions, HttpResponse } from './client.js';
import { NativeTlsClient } from './tls-client.js';
import { FetchClient } from './fetch-client.js';
import { CurlClient } from './curl-client.js';
import { HttpStatusError } from '../core/errors.js';

interface HybridClientOptions {
  tlsClient?: HttpClient;
  fetchClient?: HttpClient;
  curlClient?: HttpClient;
}

/**
 * HTTP client strategy:
 * - Native TLS is the fast, dependency-free primary path for protected APK sites.
 * - curl_cffi is used only when the native response is blocked/challenged.
 * - Fetch remains the final standards-based fallback.
 */
export class HybridClient implements HttpClient {
  private tlsClient: HttpClient;
  private fetchClient: HttpClient;
  private curlClient: HttpClient;

  private tlsPreferredDomains = [
    'apkmirror.com',
    'apkpure.com',
    'apkpure.net',
    'apkcombo.com',
    'd.apkpure.com',
    'dbankcloud.cn',
    'dbankcdn.com',
    'fdroid.org',
    'apt.izzysoft.de',
    'aptoide.com',
    'pool.apk.aptoide.com',
    'pool.img.aptoide.com',
  ];

  constructor(options: HybridClientOptions = {}) {
    this.tlsClient = options.tlsClient || new NativeTlsClient();
    this.fetchClient = options.fetchClient || new FetchClient();
    this.curlClient = options.curlClient || new CurlClient();
  }

  private isTlsPreferred(url: string, options?: HttpRequestOptions): boolean {
    if (options?.impersonate) return true;
    const hostname = new URL(url).hostname.toLowerCase();
    return this.tlsPreferredDomains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
  }

  private isChallengeResponse(response: HttpResponse<any>): boolean {
    if ([401, 403, 429, 503].includes(response.status)) return true;
    const body = typeof response.data === 'string' ? response.data.toLowerCase() : '';
    return (
      body.includes('cf-chl-') ||
      body.includes('challenge-platform') ||
      body.includes('just a moment...') ||
      body.includes('attention required! | cloudflare')
    );
  }

  private ensureSuccess<T>(response: HttpResponse<T>, url: string): HttpResponse<T> {
    if (response.status >= 400) {
      throw new HttpStatusError(response.status, response.statusText || '', response.finalUrl || url, response.data);
    }
    return response;
  }

  private async tryRequest<T>(client: HttpClient, url: string, options: HttpRequestOptions): Promise<HttpResponse<T>> {
    return client.request<T>(url, options);
  }

  public async request<T = any>(url: string, options: HttpRequestOptions = {}): Promise<HttpResponse<T>> {
    const protectedDomain = this.isTlsPreferred(url, options);
    const primary = protectedDomain ? this.tlsClient : this.fetchClient;
    const secondary = protectedDomain ? this.curlClient : this.tlsClient;
    const tertiary = protectedDomain ? this.fetchClient : this.curlClient;

    let primaryError: unknown;
    try {
      const response = await this.tryRequest<T>(primary, url, options);
      if (!this.isChallengeResponse(response)) return this.ensureSuccess(response, url);
      primaryError = new HttpStatusError(response.status, response.statusText || 'blocked', response.finalUrl || url, response.data);
    } catch (error) {
      primaryError = error;
      if (error instanceof HttpStatusError && ![401, 403, 429, 503].includes(error.status)) throw error;
    }

    let secondaryError: unknown;
    try {
      const response = await this.tryRequest<T>(secondary, url, options);
      if (!this.isChallengeResponse(response)) return this.ensureSuccess(response, url);
      secondaryError = new HttpStatusError(response.status, response.statusText || 'blocked', response.finalUrl || url, response.data);
    } catch (error) {
      secondaryError = error;
      if (error instanceof HttpStatusError && ![401, 403, 429, 503].includes(error.status)) throw error;
    }

    try {
      const response = await this.tryRequest<T>(tertiary, url, options);
      return this.ensureSuccess(response, url);
    } catch (tertiaryError) {
      throw secondaryError || primaryError || tertiaryError;
    }
  }

  public async get<T = any>(url: string, options: HttpRequestOptions = {}): Promise<HttpResponse<T>> {
    return this.request<T>(url, { ...options, method: 'GET' });
  }

  public async post<T = any>(url: string, body?: any, options: HttpRequestOptions = {}): Promise<HttpResponse<T>> {
    return this.request<T>(url, { ...options, method: 'POST', body });
  }

  private isBlockedDownloadError(error: any): boolean {
    const status = error?.status || error?.details?.status;
    return [401, 403, 429, 503].includes(status) || /HTTP (401|403|429|503)/i.test(error?.message || '');
  }

  public async downloadFile(
    url: string,
    destPath: string,
    options: HttpRequestOptions = {},
    onProgress?: (bytesWritten: number, totalBytes: number) => void
  ): Promise<{ filePath: string; bytesWritten: number; totalBytes: number; finalUrl: string }> {
    try {
      return await this.tlsClient.downloadFile(url, destPath, options, onProgress);
    } catch (tlsError: any) {
      if (this.isBlockedDownloadError(tlsError)) {
        try {
          const result = await this.curlClient.downloadFile(url, destPath, options, onProgress);
          onProgress?.(result.bytesWritten, result.totalBytes || result.bytesWritten);
          return result;
        } catch {
          // Continue to Fetch below.
        }
      }

      try {
        return await this.fetchClient.downloadFile(url, destPath, options, onProgress);
      } catch {
        if (!this.isBlockedDownloadError(tlsError)) {
          try {
            const result = await this.curlClient.downloadFile(url, destPath, options, onProgress);
            onProgress?.(result.bytesWritten, result.totalBytes || result.bytesWritten);
            return result;
          } catch {
            // Preserve the native error because it contains the most relevant TLS context.
          }
        }
        throw tlsError;
      }
    }
  }
}

export const defaultHttpClient = new HybridClient();
