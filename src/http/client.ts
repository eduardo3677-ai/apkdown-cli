export interface HttpRequestOptions {
  method?: 'GET' | 'POST' | 'HEAD' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  params?: Record<string, string | number | boolean>;
  body?: string | Record<string, any> | Buffer;
  json?: Record<string, any>;
  timeoutMs?: number;
  allowRedirects?: boolean;
  impersonate?: 'safari_ios' | 'safari17_0' | 'chrome124' | 'chrome120';
  streamToFile?: string;
  responseType?: 'json' | 'text' | 'buffer' | 'stream';
}

export interface HttpResponse<T = any> {
  status: number;
  statusText?: string;
  headers: Record<string, string>;
  data: T;
  finalUrl: string;
}

export interface HttpClient {
  request<T = any>(url: string, options?: HttpRequestOptions): Promise<HttpResponse<T>>;
  get<T = any>(url: string, options?: HttpRequestOptions): Promise<HttpResponse<T>>;
  post<T = any>(url: string, body?: any, options?: HttpRequestOptions): Promise<HttpResponse<T>>;
  downloadFile(
    url: string,
    destPath: string,
    options?: HttpRequestOptions,
    onProgress?: (bytesWritten: number, totalBytes: number) => void
  ): Promise<{ filePath: string; bytesWritten: number; totalBytes: number; finalUrl: string }>;
}
