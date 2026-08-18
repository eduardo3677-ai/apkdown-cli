import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { HttpClient, HttpRequestOptions, HttpResponse } from './client.js';
import { ApkDownError } from '../core/errors.js';

export class CurlClient implements HttpClient {
  private scriptPath: string;

  constructor(customScriptPath?: string) {
    if (customScriptPath) {
      this.scriptPath = customScriptPath;
    } else {
      // Resolve script relative to this file
      const currentDir = path.dirname(fileURLToPath(import.meta.url));
      const candidates = [
        path.resolve(currentDir, '../../scripts/curl_bridge.py'),
        path.resolve(currentDir, '../scripts/curl_bridge.py'),
        path.resolve(process.cwd(), 'scripts/curl_bridge.py'),
      ];
      this.scriptPath = candidates.find((p) => fs.existsSync(p)) || candidates[0];
    }
  }

  private runPythonBridge(payload: Record<string, any>): Promise<any> {
    return new Promise((resolve, reject) => {
      const proc = spawn('python3', [this.scriptPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdoutData = '';
      let stderrData = '';

      proc.stdout.on('data', (chunk) => {
        stdoutData += chunk.toString();
      });

      proc.stderr.on('data', (chunk) => {
        stderrData += chunk.toString();
      });

      proc.on('close', (code) => {
        if (code !== 0 && !stdoutData.trim()) {
          return reject(
            new ApkDownError(
              `curl_bridge process exited with code ${code}: ${stderrData}`,
              'CURL_BRIDGE_ERROR'
            )
          );
        }

        try {
          const parsed = JSON.parse(stdoutData.trim());
          if (parsed.error && parsed.status >= 400 && !parsed.body) {
            return reject(new ApkDownError(parsed.error, `HTTP_${parsed.status}`));
          }
          resolve(parsed);
        } catch (err) {
          reject(
            new ApkDownError(
              `Failed to parse curl_bridge response: ${stdoutData} (stderr: ${stderrData})`,
              'JSON_PARSE_ERROR'
            )
          );
        }
      });

      proc.on('error', (err) => {
        reject(new ApkDownError(`Failed to spawn python3: ${err.message}`, 'SPAWN_ERROR'));
      });

      proc.stdin.write(JSON.stringify(payload));
      proc.stdin.end();
    });
  }

  public async request<T = any>(url: string, options: HttpRequestOptions = {}): Promise<HttpResponse<T>> {
    const payload = {
      url,
      method: options.method || 'GET',
      headers: options.headers || {},
      params: options.params,
      data: typeof options.body === 'string' ? options.body : undefined,
      json: options.json,
      impersonate: options.impersonate || 'safari_ios',
      timeout: options.timeoutMs ? Math.round(options.timeoutMs / 1000) : 25,
      allow_redirects: options.allowRedirects ?? true,
      stream_to_file: options.streamToFile,
    };

    const res = await this.runPythonBridge(payload);
    
    let data: any = res.body;
    if (options.responseType === 'json' && typeof res.body === 'string') {
      try {
        data = JSON.parse(res.body);
      } catch {
        data = res.body;
      }
    }

    return {
      status: res.status || 200,
      headers: res.headers || {},
      data: data as T,
      finalUrl: res.finalUrl || url,
    };
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
    _onProgress?: (bytesWritten: number, totalBytes: number) => void
  ): Promise<{ filePath: string; bytesWritten: number; totalBytes: number; finalUrl: string }> {
    const res = await this.runPythonBridge({
      url,
      method: options.method || 'GET',
      headers: options.headers || {},
      impersonate: options.impersonate || 'safari_ios',
      timeout: options.timeoutMs ? Math.round(options.timeoutMs / 1000) : 60,
      stream_to_file: destPath,
    });

    if (res.error) {
      throw new ApkDownError(res.error, `HTTP_${res.status}`);
    }

    return {
      filePath: destPath,
      bytesWritten: res.bytesWritten || 0,
      totalBytes: res.totalBytes || 0,
      finalUrl: res.finalUrl || url,
    };
  }
}
