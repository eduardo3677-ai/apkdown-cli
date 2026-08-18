import * as p from '@clack/prompts';
import pc from 'picocolors';
import { ApkDownloader } from '../core/downloader.js';
import { AppDetails, AppVariant, DownloadResult } from '../core/types.js';
import { configManager } from '../core/config.js';
import { formatBytes, formatDuration, formatSpeed } from '../utils/formatting.js';
import { createDownloadProgressBar } from '../cli/ui/progress.js';

export async function runDownloadScreen(
  details: AppDetails,
  variant: AppVariant
): Promise<DownloadResult | null> {
  const config = configManager.getAll();

  const shouldDownload = await p.confirm({
    message: `Start download for ${pc.bold(details.name)} (${variant.versionName} - ${variant.architecture})?`,
    initialValue: true,
  });

  if (p.isCancel(shouldDownload) || !shouldDownload) return null;

  const bar = createDownloadProgressBar(details.name);
  bar.start(100, 0, {
    downloaded: '0 B',
    total: variant.fileSizeFormatted || 'Unknown',
    speed: '0 B/s',
    eta: '00:00',
  });

  try {
    const result = await ApkDownloader.download(details.provider, details.id, {
      variantId: variant.id,
      version: variant.versionName,
      preferredArch: variant.architecture,
      onProgress: (prog) => {
        bar.update(prog.percentage, {
          downloaded: formatBytes(prog.bytesDownloaded),
          total: prog.totalBytes > 0 ? formatBytes(prog.totalBytes) : 'Unknown',
          speed: formatSpeed(prog.speedBytesPerSec),
          eta: formatDuration(prog.etaSeconds),
        });
      },
    });

    bar.stop();
    console.log('\n');

    p.note(
      [
        `${pc.bold('File Path:')}   ${pc.green(result.filePath)}`,
        `${pc.bold('File Size:')}   ${formatBytes(result.fileSizeBytes)}`,
        `${pc.bold('Format:')}      ${result.packageType}`,
        `${pc.bold('SHA-256:')}     ${pc.dim(result.sha256 || 'N/A')} ${result.checksumVerified ? pc.green('✔ Verified') : ''}`,
      ].join('\n'),
      'Download Complete'
    );

    return result;
  } catch (err: any) {
    bar.stop();
    console.log('\n');
    p.note(`Download failed: ${err.message}`, 'Download Error');
    return null;
  }
}
