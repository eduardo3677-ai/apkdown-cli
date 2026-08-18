import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import { HttpClient, HttpRequestOptions, HttpResponse } from './client.js';
import { ApkDownError, DownloadError } from '../core/errors.js';
import { DEFAULT_USER_AGENT } from '../core/constants.js';

export class FetchClient implements HttpClient {
  private defaultHeaders: Record<string, string>;

  constructor(customHeaders?: Record<string, string>) {
    this.defaultHeaders = {
      'User-Agent': DEFAULT_USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      ...customHeaders,
    };
  }

  public async request<T = any>(url: string, options: HttpRequestOptions = {}): Promise<HttpResponse<T>> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 25000);

    let fullUrl = url;
    if (options.params) {
      const u = new URL(url);
      Object.entries(options.params).forEach(([k, v]) => {
        if (v !== undefined && v !== null) {
          u.searchParams.set(k, String(v));
        }
      });
      fullUrl = u.toString();
    }

    try {
      const headers = {
        ...this.defaultHeaders,
        ...(options.headers || {}),
      };

      let body: BodyInit | undefined = undefined;
      if (options.json) {
        headers['Content-Type'] = 'application/json';
        body = JSON.stringify(options.json);
      } else if (typeof options.body === 'string') {
        body = options.body;
      }

      const res = await fetch(fullUrl, {
        method: options.method || 'GET',
        headers,
        body,
        signal: controller.signal,
        redirect: options.allowRedirects === false ? 'manual' : 'follow',
      });

      const responseHeaders: Record<string, string> = {};
      res.headers.forEach((val, key) => {
        responseHeaders[key.toLowerCase()] = val;
      });

      let data: any;
      if (options.responseType === 'buffer') {
        const arrayBuf = await res.arrayBuffer();
        data = Buffer.from(arrayBuf);
      } else if (
        options.responseType === 'json' ||
        (responseHeaders['content-type'] && responseHeaders['content-type'].includes('application/json'))
      ) {
        data = await res.json();
      } else {
        data = await res.text();
      }

      return {
        status: res.status,
        statusText: res.statusText,
        headers: responseHeaders,
        data: data as T,
        finalUrl: res.url,
      };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw new ApkDownError(`Request timeout for ${url}`, 'TIMEOUT');
      }
      throw new ApkDownError(`Fetch request failed: ${err.message}`, 'NETWORK_ERROR', err);
    } finally {
      clearTimeout(timeout);
    }
  }

  public async get<T = any>(url: string, options: HttpRequestOptions = {}): Promise<HttpResponse<T>> {
    return this.request<T>(url, { ...options, method: 'GET' });
  }

  public async post<T = any>(url: string, body?: any, options: HttpRequestOptions = {}): Promise<HttpResponse<T>> {
    return this.request<T>(url, { ...options, method: 'POST', body, json: typeof body === 'object' ? body : undefined });
  }

  public async downloadFile(
    url: string,
    destPath: string,
    options: HttpRequestOptions = {},
    onProgress?: (bytesWritten: number, totalBytes: number) => void
  ): Promise<{ filePath: string; bytesWritten: number; totalBytes: number; finalUrl: string }> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 120000);

    try {
      const headers = {
        ...this.defaultHeaders,
        ...(options.headers || {}),
      };

      const res = await fetch(url, {
        method: options.method || 'GET',
        headers,
        signal: controller.signal,
        redirect: 'follow',
      });

      if (!res.ok) {
        throw new DownloadError(`Download failed with HTTP ${res.status}: ${res.statusText}`);
      }

      if (!res.body) {
        throw new DownloadError('Response body is empty');
      }

      const contentLength = res.headers.get('content-length');
      const totalBytes = contentLength ? parseInt(contentLength, 10) : 0;
      let bytesWritten = 0;

      const targetDir = path.dirname(destPath);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      const fileStream = fs.createWriteStream(destPath);
      const nodeReadable = Readable.fromWeb(res.body as any);

      nodeReadable.on('data', (chunk: Buffer) => {
        bytesWritten += chunk.length;
        if (onProgress) {
          onProgress(bytesWritten, totalBytes);
        }
      });

      await pipeline(nodeReadable, fileStream);

      return {
        filePath: destPath,
        bytesWritten,
        totalBytes: totalBytes || bytesWritten,
        finalUrl: res.url,
      };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw new DownloadError(`Download timed out for ${url}`);
      }
      throw new DownloadError(`Download stream failed: ${err.message}`, err);
    } finally {
      clearTimeout(timeout);
    }
  }
}
