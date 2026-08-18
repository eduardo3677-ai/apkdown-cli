import { describe, expect, it, vi } from 'vitest';
import { HybridClient } from '../src/http/hybrid-client.js';
import { DownloadError, HttpStatusError } from '../src/core/errors.js';
import { HttpClient, HttpResponse } from '../src/http/client.js';

function clientWith(response: HttpResponse<any> | Error, download?: any): HttpClient {
  const request = vi.fn(async () => {
    if (response instanceof Error) throw response;
    return response;
  });
  return {
    request,
    get: request,
    post: request,
    downloadFile: download || vi.fn(async () => ({ filePath: '/tmp/file', bytesWritten: 1, totalBytes: 1, finalUrl: 'https://example.test/file' })),
  };
}

const response = (status: number, data: any = '', url = 'https://www.apkmirror.com/search') => ({
  status,
  statusText: status === 200 ? 'OK' : 'Error',
  headers: {},
  data,
  finalUrl: url,
});

describe('HybridClient HTTP fallback semantics', () => {
  it('falls back to curl when native TLS is rate-limited', async () => {
    const tls = clientWith(response(429, 'rate limited'));
    const curl = clientWith(response(200, '<html>real page</html>'));
    const fetch = clientWith(new Error('fetch must not run'));
    const client = new HybridClient({ tlsClient: tls, curlClient: curl, fetchClient: fetch });

    const result = await client.get('https://www.apkmirror.com/search');

    expect(result.status).toBe(200);
    expect(tls.request).toHaveBeenCalledOnce();
    expect(curl.request).toHaveBeenCalledOnce();
    expect(fetch.request).not.toHaveBeenCalled();
  });

  it('treats 404 as a real provider error instead of parsing the error page', async () => {
    const tls = clientWith(response(404, 'not found'));
    const curl = clientWith(response(200, 'wrong fallback'));
    const client = new HybridClient({ tlsClient: tls, curlClient: curl, fetchClient: curl });

    await expect(client.get('https://www.apkmirror.com/missing')).rejects.toMatchObject<HttpStatusError>({
      status: 404,
      code: 'HTTP_404',
    });
    expect(curl.request).not.toHaveBeenCalled();
  });

  it('uses curl download fallback after a native 403', async () => {
    const tlsDownload = vi.fn(async () => {
      throw new DownloadError('Download failed with HTTP 403', { status: 403 });
    });
    const curlDownload = vi.fn(async () => ({
      filePath: '/tmp/app.apk', bytesWritten: 42, totalBytes: 42, finalUrl: 'https://cdn.example/app.apk',
    }));
    const tls = clientWith(response(200), tlsDownload);
    const curl = clientWith(response(200), curlDownload);
    const fetch = clientWith(response(200), vi.fn(async () => { throw new Error('fetch must not run'); }));
    const client = new HybridClient({ tlsClient: tls, curlClient: curl, fetchClient: fetch });

    const progress = vi.fn();
    const result = await client.downloadFile('https://d.apkpure.com/app.apk', '/tmp/app.apk', {}, progress);

    expect(result.bytesWritten).toBe(42);
    expect(curlDownload).toHaveBeenCalledOnce();
    expect(progress).toHaveBeenLastCalledWith(42, 42);
  });
});
