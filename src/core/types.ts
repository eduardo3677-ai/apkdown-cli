/**
 * Domain types and interfaces for apkdown-cli
 */

export type Architecture = 
  | 'arm64-v8a' 
  | 'armeabi-v7a' 
  | 'armeabi' 
  | 'x86' 
  | 'x86_64' 
  | 'universal' 
  | 'all';

export type ReleaseChannel = 
  | 'stable' 
  | 'beta' 
  | 'alpha' 
  | 'insider' 
  | 'preview' 
  | 'all';

export type PackageType = 
  | 'APK' 
  | 'XAPK' 
  | 'APKM' 
  | 'APKS' 
  | 'ZIP' 
  | 'UNKNOWN';

export interface AppSearchResult {
  /** Unique ID or slug for the app within the provider */
  id: string;
  /** Human-readable app name */
  name: string;
  /** Android package name (e.g. com.whatsapp) */
  packageName: string;
  /** Developer or publisher name */
  developer?: string;
  /** Latest known version string */
  version?: string;
  /** App icon URL */
  iconUrl?: string;
  /** Short summary or description */
  description?: string;
  /** Provider identifier (e.g. aptoide, apkmirror, apkpure, fdroid, etc.) */
  provider: string;
  /** App rating (0.0 - 5.0) */
  rating?: number;
  /** Total downloads count or formatted string */
  downloads?: number | string;
  /** Web URL for more details */
  sourceUrl?: string;
  /** Date of the last update */
  updatedAt?: string;
}

export interface AppVariant {
  /** Variant identifier */
  id: string;
  /** Version display string (e.g. 12.9.2-beta) */
  versionName: string;
  /** Integer version code if available */
  versionCode?: number;
  /** Supported CPU architecture */
  architecture: Architecture;
  /** Minimum supported Android version (e.g. Android 8.0+) */
  minAndroid?: string;
  /** Screen DPI (e.g. nodpi, 120-640dpi, 480dpi) */
  dpi?: string;
  /** File format (APK, XAPK, APKM, etc.) */
  packageType: PackageType;
  /** Size in bytes */
  fileSizeBytes?: number;
  /** Human readable file size (e.g. 84.5 MB) */
  fileSizeFormatted?: string;
  /** Direct or resolvable download URL */
  downloadUrl?: string;
  /** Internal download token or payload needed for resolution */
  downloadToken?: string;
  /** Cryptographic hashes */
  hashes?: {
    md5?: string;
    sha1?: string;
    sha256?: string;
  };
  /** Whether this variant is a beta / preview / insider release */
  isBeta: boolean;
  /** Release channel */
  releaseChannel: ReleaseChannel;
  /** Release date string */
  releaseDate?: string;
  /** Extra provider-specific metadata */
  metadata?: Record<string, any>;
}

export interface AppDetails {
  /** Unique ID */
  id: string;
  /** App name */
  name: string;
  /** Package name */
  packageName: string;
  /** Developer */
  developer?: string;
  /** App description */
  description?: string;
  /** Icon URL */
  iconUrl?: string;
  /** Provider name */
  provider: string;
  /** Source URL on provider site */
  sourceUrl?: string;
  /** Latest version name */
  latestVersion?: string;
  /** Available download variants */
  variants: AppVariant[];
  /** Requested Android permissions */
  permissions?: string[];
  /** Screenshots URLs */
  screenshots?: string[];
  /** Rating */
  rating?: number;
  /** Downloads count */
  downloads?: number | string;
}

export interface DownloadProgress {
  percentage: number;
  bytesDownloaded: number;
  totalBytes: number;
  speedBytesPerSec: number;
  etaSeconds: number;
  status: 'starting' | 'downloading' | 'verifying' | 'completed' | 'failed';
}

export interface DownloadOptions {
  /** Target output directory */
  outputDir?: string;
  /** Custom destination filename */
  filename?: string;
  /** Preferred architecture filter */
  preferredArch?: Architecture;
  /** Preferred release channel */
  channel?: ReleaseChannel;
  /** Allow beta or prerelease versions */
  allowBeta?: boolean;
  /** Specific version string or 'latest' */
  version?: string;
  /** Specific variant ID */
  variantId?: string;
  /** Overwrite existing file */
  forceOverwrite?: boolean;
  /** Verify MD5 / SHA256 hashes if available */
  verifyChecksum?: boolean;
  /** Callback for progress updates */
  onProgress?: (progress: DownloadProgress) => void;
}

export interface DownloadResult {
  filePath: string;
  fileName: string;
  fileSizeBytes: number;
  sha256?: string;
  md5?: string;
  checksumVerified?: boolean;
  packageType: PackageType;
  durationMs: number;
}

export interface ProviderSearchOptions {
  limit?: number;
  includeBeta?: boolean;
  arch?: Architecture;
}

export interface SearchOptions {
  /** Query keyword or package name */
  query: string;
  /** Specific provider name, or 'all' */
  provider?: string;
  /** Maximum results per provider */
  limit?: number;
  /** Allow beta/insider versions in search results */
  includeBeta?: boolean;
  /** Filter by architecture */
  arch?: Architecture;
}

export interface ApkDownConfig {
  downloadDir: string;
  defaultProvider: string;
  preferredArch: Architecture;
  includeBeta: boolean;
  defaultChannel: ReleaseChannel;
  maxConcurrency: number;
  timeoutMs: number;
  verifyChecksums: boolean;
  userAgent: string;
  proxy?: string;
  providers: {
    aptoide: boolean;
    apkmirror: boolean;
    apkpure: boolean;
    apkcombo: boolean;
    fdroid: boolean;
    github: boolean;
    appgallery: boolean;
  };
}
