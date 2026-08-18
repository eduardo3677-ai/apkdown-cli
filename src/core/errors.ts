export class ApkDownError extends Error {
  constructor(message: string, public readonly code: string = 'UNKNOWN_ERROR', public readonly details?: any) {
    super(message);
    this.name = 'ApkDownError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}


export class HttpStatusError extends ApkDownError {
  public readonly status: number;
  public readonly url: string;
  public readonly body: unknown;

  constructor(status: number, statusText: string, url: string, body?: unknown) {
    super(`HTTP ${status}${statusText ? ` ${statusText}` : ''} for ${url}`, `HTTP_${status}`, {
      status,
      statusText,
      url,
      body,
    });
    this.name = 'HttpStatusError';
    this.status = status;
    this.url = url;
    this.body = body;
  }
}

export class ProviderError extends ApkDownError {
  constructor(provider: string, message: string, details?: any) {
    super(`[Provider: ${provider}] ${message}`, 'PROVIDER_ERROR', details);
    this.name = 'ProviderError';
  }
}

export class DownloadError extends ApkDownError {
  constructor(message: string, details?: any) {
    super(message, 'DOWNLOAD_ERROR', details);
    this.name = 'DownloadError';
  }
}

export class ChecksumMismatchError extends ApkDownError {
  constructor(expected: string, actual: string, algorithm: string = 'SHA256') {
    super(`Checksum mismatch (${algorithm}). Expected ${expected}, got ${actual}`, 'CHECKSUM_MISMATCH', {
      expected,
      actual,
      algorithm,
    });
    this.name = 'ChecksumMismatchError';
  }
}

export class VariantNotFoundError extends ApkDownError {
  constructor(query: string, arch?: string, version?: string) {
    super(
      `No matching APK variant found for "${query}" (arch: ${arch || 'any'}, version: ${version || 'latest'})`,
      'VARIANT_NOT_FOUND',
      { query, arch, version }
    );
    this.name = 'VariantNotFoundError';
  }
}
