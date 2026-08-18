/**
 * String and numeric formatting utilities
 */

export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes <= 0 || isNaN(bytes)) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const num = parseFloat((bytes / Math.pow(k, i)).toFixed(dm));
  return `${num} ${sizes[i]}`;
}

export function formatSpeed(bytesPerSec: number): string {
  return `${formatBytes(bytesPerSec)}/s`;
}

export function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0 || !isFinite(seconds)) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;

  if (hrs > 0) {
    return `${hrs.toString().padStart(2, '0')}:${remMins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${remMins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function sanitizeFileName(name: string): string {
  return name
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .replace(/\s+/g, '_')
    .trim();
}

export function formatRating(rating?: number): string {
  if (rating === undefined || rating === null || isNaN(rating)) return 'N/A';
  return `★ ${rating.toFixed(1)}`;
}

export function formatDownloads(downloads?: number | string): string {
  if (downloads === undefined || downloads === null) return 'N/A';
  if (typeof downloads === 'string') return downloads;
  if (downloads >= 1_000_000_000) {
    return `${(downloads / 1_000_000_000).toFixed(1)}B+`;
  }
  if (downloads >= 1_000_000) {
    return `${(downloads / 1_000_000).toFixed(1)}M+`;
  }
  if (downloads >= 1_000) {
    return `${(downloads / 1_000).toFixed(1)}K+`;
  }
  return downloads.toString();
}
