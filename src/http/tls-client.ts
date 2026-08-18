import https from 'https';
import http from 'http';
import crypto from 'crypto';
import zlib from 'zlib';
import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';
import { HttpClient, HttpRequestOptions, HttpResponse } from './client.js';
import { ApkDownError, DownloadError } from '../core/errors.js';
import { DEFAULT_USER_AGENT, CHROME_USER_AGENT } from '../core/constants.js';

/**
 * Modern browser TLS 1.3/1.2 cipher suite matching Chrome 124 & Safari 17
 */
export const BROWSER_CIPHER_SUITE = [
  'TLS_AES_128_GCM_SHA256',
  'TLS_AES_256_GCM_SHA384',
  'TLS_CHACHA20_POLY1305_SHA256',
  'ECDHE-ECDSA-AES128-GCM-SHA256',
  'ECDHE-RSA-AES128-GCM-SHA256',
  'ECDHE-ECDSA-AES256-GCM-SHA384',
  'ECDHE-RSA-AES256-GCM-SHA384',
  'ECDHE-ECDSA-CHACHA20-POLY1305',
  'ECDHE-RSA-CHACHA20-POLY1305',
  'ECDHE-RSA-AES128-SHA',
  'ECDHE-RSA-AES256-SHA',
  'AES128-GCM-SHA256',
  'AES256-GCM-SHA384',
  'AES128-SHA',
  'AES256-SHA',
].join(':');

/**
 * Pure TypeScript/Node.js High-Performance TLS & HTTP Streaming Client
 * with browser fingerprinting, 4MB write buffers, cookie jar, and auto redirect handling.
 */
export class NativeTlsClient implements HttpClient {
  private cookies: Map<string, string> = new Map();
  private httpsAgent: https.Agent;
  private httpAgent: http.Agent;

  constructor() {
    this.httpsAgent = new https.Agent({
      ciphers: BROWSER_CIPHER_SUITE,
      minVersion: 'TLSv1.2',
      maxVersion: 'TLSv1.3',
      ecdhCurve: 'X25519:P-256:P-384:P-521',
      keepAlive: true,
      keepAliveMsecs: 30000,
      maxSockets: 64,
      maxFreeSockets: 32,
      secureOptions:
        crypto.constants.SSL_OP_NO_SSLv2 |
        crypto.constants.SSL_OP_NO_SSLv3 |
        crypto.constants.SSL_OP_NO_TLSv1 |
        crypto.constants.SSL_OP_NO_TLSv1_1 |
        crypto.constants.SSL_OP_DONT_INSERT_EMPTY_FRAGMENTS,
    });

    this.httpAgent = new http.Agent({
      keepAlive: true,
      keepAliveMsecs: 30000,
      maxSockets: 64,
      maxFreeSockets: 32,
    });
  }

  private buildBrowserHeaders(url: URL, options: HttpRequestOptions, isDownload = false): Record<string, string> {
    const isMobile = options.impersonate === 'safari_ios';
    const userAgent = isMobile ? DEFAULT_USER_AGENT : (options.headers?.['User-Agent'] || CHROME_USER_AGENT);

    const headers: Record<string, string> = {
      Host: url.host,
      Connection: 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'User-Agent': userAgent,
      Accept: isDownload
        ? 'application/vnd.android.package-archive,application/octet-stream,*/*;q=0.8'
        : 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9,es;q=0.8',
    };

    // For file downloads, don't request double compression
    if (!isDownload) {
      headers['Accept-Encoding'] = 'gzip, deflate, br';
    } else {
      headers['Accept-Encoding'] = 'identity';
    }

    if (!isMobile) {
      headers['sec-ch-ua'] = '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"';
      headers['sec-ch-ua-mobile'] = '?0';
      headers['sec-ch-ua-platform'] = '"Windows"';
      headers['Sec-Fetch-Site'] = options.headers?.Referer ? 'same-origin' : 'none';
      headers['Sec-Fetch-Mode'] = isDownload ? 'no-cors' : 'navigate';
      headers['Sec-Fetch-User'] = '?1';
      headers['Sec-Fetch-Dest'] = isDownload ? 'empty' : 'document';
    }

    // Append cookies from session cookie jar
    const hostKey = url.hostname;
    const matchingCookies = Array.from(this.cookies.entries())
      .filter(([k]) => k.startsWith(hostKey) || hostKey.endsWith(k.split('::')[0]))
      .map(([k, v]) => `${k.split('::')[1]}=${v}`);

    if (matchingCookies.length > 0) {
      headers['Cookie'] = matchingCookies.join('; ');
    }

    // Merge custom options headers
    if (options.headers) {
      Object.entries(options.headers).forEach(([k, v]) => {
        if (v !== undefined) {
          headers[k] = v;
        }
      });
    }

    return headers;
  }

  private saveCookies(hostname: string, setCookieHeader?: string | string[]): void {
    if (!setCookieHeader) return;
    const cookies = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
    for (const raw of cookies) {
      const parts = raw.split(';')[0].split('=');
      if (parts.length >= 2) {
        const name = parts[0].trim();
        const value = parts.slice(1).join('=').trim();
        this.cookies.set(`${hostname}::${name}`, value);
      }
    }
  }

  private createDecompressor(encoding?: string): zlib.Gunzip | zlib.Inflate | zlib.BrotliDecompress | null {
    if (!encoding) return null;
    const enc = encoding.toLowerCase().trim();
    if (enc.includes('gzip')) {
      return zlib.createGunzip({ chunkSize: 128 * 1024 });
    } else if (enc.includes('deflate')) {
      return zlib.createInflate({ chunkSize: 128 * 1024 });
    } else if (enc.includes('br')) {
      return zlib.createBrotliDecompress({ chunkSize: 128 * 1024 });
    }
    return null;
  }

  public async request<T = any>(
    url: string,
    options: HttpRequestOptions = {},
    redirectCount = 0
  ): Promise<HttpResponse<T>> {
    if (redirectCount > 10) {
      throw new ApkDownError('Too many redirects', 'REDIRECT_LOOP');
    }

    const parsedUrl = new URL(url);
    if (options.params) {
      Object.entries(options.params).forEach(([k, v]) => {
        if (v !== undefined && v !== null) {
          parsedUrl.searchParams.set(k, String(v));
        }
      });
    }

    const isHttps = parsedUrl.protocol === 'https:';
    const requestFn = isHttps ? https.request : http.request;
    const agent = isHttps ? this.httpsAgent : this.httpAgent;

    const headers = this.buildBrowserHeaders(parsedUrl, options, false);
    let requestBody: Buffer | string | undefined = undefined;

    if (options.json) {
      headers['Content-Type'] = 'application/json';
      requestBody = JSON.stringify(options.json);
      headers['Content-Length'] = String(Buffer.byteLength(requestBody));
    } else if (options.body) {
      if (typeof options.body === 'string') {
        requestBody = options.body;
      } else if (Buffer.isBuffer(options.body)) {
        requestBody = options.body;
      } else {
        requestBody = JSON.stringify(options.body);
        headers['Content-Type'] = 'application/json';
      }
      headers['Content-Length'] = String(Buffer.byteLength(requestBody));
    }

    return new Promise((resolve, reject) => {
      const timeoutMs = options.timeoutMs || 25000;

      const req = requestFn(
        parsedUrl,
        {
          method: options.method || 'GET',
          headers,
          agent,
          timeout: timeoutMs,
        },
        (res) => {
          this.saveCookies(parsedUrl.hostname, res.headers['set-cookie']);

          // Handle Redirects
          const statusCode = res.statusCode || 200;


          if (
            (statusCode === 301 || statusCode === 302 || statusCode === 303 || statusCode === 307 || statusCode === 308) &&
            res.headers.location &&
            options.allowRedirects !== false
          ) {
            const redirectUrl = new URL(res.headers.location, parsedUrl).toString();
            res.resume();
            return resolve(
              this.request<T>(
                redirectUrl,
                {
                  ...options,
                  method: statusCode === 303 ? 'GET' : options.method,
                  headers: { ...options.headers, Referer: parsedUrl.toString() },
                },
                redirectCount + 1
              )
            );
          }

          const encoding = res.headers['content-encoding'];
          const decompressor = this.createDecompressor(encoding);
          const chunks: Buffer[] = [];
          const stream = decompressor ? res.pipe(decompressor) : res;

          stream.on('data', (chunk: Buffer) => chunks.push(chunk));
          stream.on('end', () => {
            const buffer = Buffer.concat(chunks);
            const responseHeaders: Record<string, string> = {};
            Object.entries(res.headers).forEach(([k, v]) => {
              if (v !== undefined) {
                responseHeaders[k.toLowerCase()] = Array.isArray(v) ? v.join(', ') : v;
              }
            });

            let data: any;
            if (options.responseType === 'buffer') {
              data = buffer;
            } else if (
              options.responseType === 'json' ||
              (responseHeaders['content-type'] && responseHeaders['content-type'].includes('application/json'))
            ) {
              try {
                data = JSON.parse(buffer.toString('utf-8'));
              } catch {
                data = buffer.toString('utf-8');
              }
            } else {
              data = buffer.toString('utf-8');
            }

            resolve({
              status: statusCode,
              statusText: res.statusMessage,
              headers: responseHeaders,
              data: data as T,
              finalUrl: parsedUrl.toString(),
            });
          });

          stream.on('error', (err) => {
            if (statusCode >= 400) {
              const responseHeaders: Record<string, string> = {};
              Object.entries(res.headers).forEach(([k, v]) => {
                if (v !== undefined) {
                  responseHeaders[k.toLowerCase()] = Array.isArray(v) ? v.join(', ') : v;
                }
              });
              resolve({
                status: statusCode,
                statusText: res.statusMessage,
                headers: responseHeaders,
                data: Buffer.concat(chunks).toString('utf-8') as any,
                finalUrl: parsedUrl.toString(),
              });
            } else {
              reject(new ApkDownError(`Stream decompression error: ${err.message}`, 'STREAM_ERROR', err));
            }
          });
        }
      );

      req.on('timeout', () => {
        req.destroy();
        reject(new ApkDownError(`Request timeout after ${timeoutMs}ms for ${url}`, 'TIMEOUT'));
      });

      req.on('error', (err) => {
        reject(new ApkDownError(`TLS request error: ${err.message}`, 'NETWORK_ERROR', err));
      });

      if (requestBody) {
        req.write(requestBody);
      }
      req.end();
    });
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
    onProgress?: (bytesWritten: number, totalBytes: number) => void,
    redirectCount = 0
  ): Promise<{ filePath: string; bytesWritten: number; totalBytes: number; finalUrl: string }> {
    if (redirectCount > 10) {
      throw new DownloadError('Too many redirects during download');
    }

    const parsedUrl = new URL(url);
    const isHttps = parsedUrl.protocol === 'https:';
    const requestFn = isHttps ? https.request : http.request;
    const agent = isHttps ? this.httpsAgent : this.httpAgent;

    const headers = this.buildBrowserHeaders(parsedUrl, options, true);

    return new Promise((resolve, reject) => {
      const timeoutMs = options.timeoutMs || 180000;

      const req = requestFn(
        parsedUrl,
        {
          method: options.method || 'GET',
          headers,
          agent,
          timeout: timeoutMs,
        },
        async (res) => {
          this.saveCookies(parsedUrl.hostname, res.headers['set-cookie']);

          const statusCode = res.statusCode || 200;


          if (
            (statusCode === 301 || statusCode === 302 || statusCode === 303 || statusCode === 307 || statusCode === 308) &&
            res.headers.location
          ) {
            const redirectUrl = new URL(res.headers.location, parsedUrl).toString();
            res.resume();
            return resolve(
              this.downloadFile(
                redirectUrl,
                destPath,
                { ...options, headers: { ...options.headers, Referer: parsedUrl.toString() } },
                onProgress,
                redirectCount + 1
              )
            );
          }

          if (statusCode >= 400) {
            res.resume();
            return reject(new DownloadError(`Download failed with HTTP ${statusCode}: ${res.statusMessage}`, { status: statusCode, url: parsedUrl.toString() }));
          }

          const contentLength = res.headers['content-length'];
          const totalBytes = contentLength ? parseInt(contentLength, 10) : 0;
          let bytesWritten = 0;
          let lastProgressReport = 0;

          const targetDir = path.dirname(destPath);
          if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
          }

          // High-throughput 4MB file write stream buffer
          const fileStream = fs.createWriteStream(destPath, { highWaterMark: 1024 * 1024 * 4 });
          const encoding = res.headers['content-encoding'];
          const decompressor = this.createDecompressor(encoding);
          const sourceStream = decompressor ? res.pipe(decompressor) : res;

          sourceStream.on('data', (chunk: Buffer) => {
            bytesWritten += chunk.length;
            const now = Date.now();
            if (onProgress && (now - lastProgressReport >= 150 || bytesWritten === totalBytes)) {
              lastProgressReport = now;
              onProgress(bytesWritten, totalBytes || bytesWritten);
            }
          });

          try {
            await pipeline(sourceStream, fileStream);
            if (onProgress) {
              onProgress(bytesWritten, totalBytes || bytesWritten);
            }
            resolve({
              filePath: destPath,
              bytesWritten,
              totalBytes: totalBytes || bytesWritten,
              finalUrl: parsedUrl.toString(),
            });
          } catch (err: any) {
            if (fs.existsSync(destPath)) {
              try { fs.unlinkSync(destPath); } catch {}
            }
            reject(new DownloadError(`File streaming failed: ${err.message}`, err));
          }
        }
      );

      req.on('timeout', () => {
        req.destroy();
        reject(new DownloadError(`Download request timed out after ${timeoutMs}ms`));
      });

      req.on('error', (err) => {
        reject(new DownloadError(`Download network error: ${err.message}`, err));
      });

      req.end();
    });
  }
}

export const nativeTlsClient = new NativeTlsClient();
