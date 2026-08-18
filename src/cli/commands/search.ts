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
  .description('Search APKs across multiple repositories with provider exclusion and architecture filtering')
  .argument('<query>', 'App name or package identifier to search for')
  .option('-p, --provider <providers>', 'Filter by provider or comma-separated list (aptoide, apkmirror, apkpure, apkcombo, fdroid, izzyondroid, github, appgallery, or all)', 'all')
  .option('-x, --exclude <providers>', 'Comma-separated list of providers to exclude (e.g. appgallery,aptoide)')
  .option('-l, --limit <number>', 'Maximum number of results to display', '15')
  .option('-b, --beta', 'Include Beta, Alpha, and Insider preview versions', false)
  .option('-a, --arch <architecture>', 'Filter variants by target CPU architecture (arm64-v8a, armeabi-v7a, x86, x86_64, universal, all)')
  .option('-d, --download', 'Prompt to immediately download a selected result', false)
  .option('--json', 'Output results in JSON format', false)
  .action(async (query: string, options: any) => {
    if (!options.json) {
      logger.info(`Searching for "${pc.bold(query)}" across providers...`);
    }

    const excludeList = options.exclude
      ? options.exclude.split(',').map((p: string) => p.trim().toLowerCase()).filter(Boolean)
      : [];

    if (!options.json && excludeList.length > 0) {
      logger.info(`Excluding providers: ${excludeList.map((p: string) => pc.yellow(p)).join(', ')}`);
    }

    try {
      const results = await providerRegistry.search({
        query,
        provider: options.provider,
        excludeProviders: excludeList,
        limit: parseInt(options.limit, 10) || 15,
        includeBeta: options.beta,
        arch: options.arch as Architecture,
      });

      if (options.json) {
        console.log(JSON.stringify(results, null, 2));
        return;
      }

      if (results.length === 0) {
        logger.warn(`No APKs found matching "${query}". Try searching another keyword or adjusting filters.`);
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
      if (options.json) {
        console.error(JSON.stringify({ error: err.message }));
      } else {
        logger.error(`Search error: ${err.message}`);
      }
    }
  });
