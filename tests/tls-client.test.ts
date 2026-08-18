import { describe, it, expect } from 'vitest';
import http from 'http';
import zlib from 'zlib';
import { NativeTlsClient, BROWSER_CIPHER_SUITE } from '../src/http/tls-client.js';

describe('NativeTlsClient (Pure Node.js TLS & Browser Impersonator)', () => {
  const client = new NativeTlsClient();

  it('should define modern browser TLS 1.3/1.2 cipher suites', () => {
    expect(BROWSER_CIPHER_SUITE).toContain('TLS_AES_128_GCM_SHA256');
    expect(BROWSER_CIPHER_SUITE).toContain('ECDHE-ECDSA-AES128-GCM-SHA256');
    expect(BROWSER_CIPHER_SUITE).toContain('ECDHE-RSA-AES128-GCM-SHA256');
  });

  it('should execute GET request and handle gzip decompression with local server', async () => {
    // Create local HTTP test server
    const server = http.createServer((req, res) => {
      const jsonStr = JSON.stringify({ success: true, message: 'Native TLS Engine Working' });
      const gzipped = zlib.gzipSync(jsonStr);

      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Content-Encoding': 'gzip',
      });
      res.end(gzipped);
    });

    await new Promise<void>((resolve) => server.listen(0, resolve));
    const address = server.address() as any;
    const port = address.port;

    try {
      const res = await client.get(`http://127.0.0.1:${port}/test`, {
        responseType: 'json',
        timeoutMs: 5000,
      });

      expect(res.status).toBe(200);
      expect(res.data.success).toBe(true);
      expect(res.data.message).toBe('Native TLS Engine Working');
    } finally {
      server.close();
    }
  });

  it('should maintain cookies across redirects with local server', async () => {
    let requestCount = 0;
    const server = http.createServer((req, res) => {
      requestCount++;
      if (req.url === '/redirect') {
        res.writeHead(302, {
          Location: '/destination',
          'Set-Cookie': 'session_token=apkdown_secure_cookie; Path=/',
        });
        res.end();
      } else if (req.url === '/destination') {
        const cookie = req.headers.cookie || '';
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ requestCount, cookie }));
      }
    });

    await new Promise<void>((resolve) => server.listen(0, resolve));
    const address = server.address() as any;
    const port = address.port;

    try {
      const res = await client.get(`http://127.0.0.1:${port}/redirect`, {
        responseType: 'json',
        timeoutMs: 5000,
      });

      expect(res.status).toBe(200);
      expect(res.data.cookie).toContain('session_token=apkdown_secure_cookie');
    } finally {
      server.close();
    }
  });
});
