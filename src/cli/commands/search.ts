import { Command } from 'commander';
import pc from 'picocolors';
import { providerRegistry } from '../../providers/registry.js';
import { ApkDownloader } from '../../core/downloader.js';
import { Architecture } from '../../core/types.js';
import { logger } from '../ui/logger.js';
import { renderSearchResultsTable } from '../ui/table.js';
import { createDownloadProgressBar } from '../ui/progress.js';
import { formatBytes, formatDuration, formatSpeed } from '../../utils/formatting.js';

export const searchCommand = new Command('search')
  .alias('s')
  .description('Search APKs across multiple repositories (Aptoide, APKMirror, APKPure, APKCombo, F-Droid, GitHub, AppGallery)')
  .argument('<query>', 'App name or package identifier to search for')
  .option('-p, --provider <provider>', 'Filter by provider (aptoide, apkmirror, apkpure, apkcombo, fdroid, github, appgallery, or all)', 'all')
  .option('-l, --limit <number>', 'Maximum number of results to display', '15')
  .option('-b, --beta', 'Include Beta, Alpha, and Insider preview versions', false)
  .option('-a, --arch <architecture>', 'Target CPU architecture (arm64-v8a, armeabi-v7a, x86_64, universal, all)')
  .option('-d, --download', 'Prompt to immediately download a selected result', false)
  .action(async (query: string, options: any) => {
    logger.info(`Searching for "${pc.bold(query)}" across providers...`);

    try {
      const results = await providerRegistry.search({
        query,
        provider: options.provider,
        limit: parseInt(options.limit, 10) || 15,
        includeBeta: options.beta,
        arch: options.arch as Architecture,
      });

      if (results.length === 0) {
        logger.warn(`No APKs found matching "${query}". Try searching another keyword or provider.`);
        return;
      }

      console.log('\n' + renderSearchResultsTable(results) + '\n');
      logger.success(`Found ${results.length} results.`);

      if (options.download) {
        // Fast download prompt
        const readline = await import('readline/promises');
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

        const answer = await rl.question(pc.cyan('Enter result number (#) to download (or press Enter to cancel): '));
        rl.close();

        const num = parseInt(answer.trim(), 10);
        if (num >= 1 && num <= results.length) {
          const selected = results[num - 1];
          logger.info(`Starting download for ${pc.bold(selected.name)} from ${selected.provider}...`);

          const bar = createDownloadProgressBar(selected.name);
          bar.start(100, 0, {
            downloaded: '0 B',
            total: 'Unknown',
            speed: '0 B/s',
            eta: '00:00',
          });

          const result = await ApkDownloader.download(selected.provider, selected.id, {
            preferredArch: options.arch as Architecture,
            allowBeta: options.beta,
            onProgress: (p) => {
              bar.update(p.percentage, {
                downloaded: formatBytes(p.bytesDownloaded),
                total: formatBytes(p.totalBytes),
                speed: formatSpeed(p.speedBytesPerSec),
                eta: formatDuration(p.etaSeconds),
              });
            },
          });

          bar.stop();
          console.log('\n');
          logger.success(`Downloaded successfully: ${pc.bold(result.filePath)}`);
          logger.info(`Size: ${formatBytes(result.fileSizeBytes)} | SHA256: ${pc.dim(result.sha256 || 'N/A')}`);
        }
      }
    } catch (err: any) {
      logger.error(`Search error: ${err.message}`);
    }
  });
