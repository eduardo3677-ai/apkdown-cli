import { Command } from 'commander';
import pc from 'picocolors';
import Table from 'cli-table3';
import { ApkDownloader, ProviderComparisonResult } from '../../core/downloader.js';
import { providerRegistry } from '../../providers/registry.js';
import { configManager } from '../../core/config.js';
import { Architecture, DownloadProgress, ReleaseChannel } from '../../core/types.js';
import { logger } from '../ui/logger.js';
import { createDownloadProgressBar } from '../ui/progress.js';
import { formatBytes, formatDuration, formatSpeed } from '../../utils/formatting.js';

export const downloadCommand = new Command('download')
  .alias('d')
  .description('Download an APK or bundle from supported providers (auto-compares versions if provider is omitted)')
  .argument('<app>', 'App name, package name, or URL/repository to download')
  .option('-p, --provider <provider>', 'Provider to use (aptoide, apkmirror, apkpure, apkcombo, fdroid, izzyondroid, github, appgallery, or all)', 'all')
  .option('-v, --version <version>', 'Specific version string to download (e.g. 12.9.2 or "latest")', 'latest')
  .option('-a, --arch <architecture>', 'Target CPU architecture (arm64-v8a, armeabi-v7a, x86_64, universal, all)')
  .option('-c, --channel <channel>', 'Release channel: stable, beta, alpha, insider, preview, all', 'stable')
  .option('-b, --beta', 'Shorthand to include/allow beta releases', false)
  .option('-o, --output <dir>', 'Target output directory for the downloaded APK')
  .option('-f, --force', 'Force re-download and overwrite existing files', false)
  .option('--no-verify', 'Skip cryptographic checksum verification')
  .action(async (app: string, options: any) => {
    const config = configManager.getAll();
    let targetProvider = options.provider;

    logger.info(`Resolving download target for "${pc.bold(app)}"...`);

    try {
      let chosenProvider = targetProvider;
      let chosenAppId = app;

      if (targetProvider === 'all' || !targetProvider) {
        logger.info('Searching across all providers to find and compare latest versions...');
      }

      let bar: any = null;

      const effectiveChannel = options.beta ? 'beta' : (options.channel as ReleaseChannel);

      const result = await ApkDownloader.download(
        targetProvider === 'all' ? undefined : targetProvider,
        app,
        {
          version: options.version,
          preferredArch: options.arch as Architecture,
          channel: effectiveChannel,
          allowBeta: options.beta || effectiveChannel !== 'stable',
          outputDir: options.output,
          forceOverwrite: options.force,
          verifyChecksum: options.verify !== false,
          onComparison: (candidates: ProviderComparisonResult[], chosen: ProviderComparisonResult) => {
            console.log('\n' + pc.bold('Cross-Provider Version Comparison:'));

            const table = new Table({
              head: [
                pc.bold('Provider'),
                pc.bold('App Name'),
                pc.bold('Package'),
                pc.bold('Found Version'),
                pc.bold('Format'),
                pc.bold('Status'),
              ],
              colWidths: [15, 25, 28, 16, 10, 16],
            });

            for (const cand of candidates) {
              const isWinner = cand.provider === chosen.provider;
              const status = isWinner ? pc.green(pc.bold('★ LATEST SELECTED')) : pc.dim('Alternative');
              const format = cand.bestVariant.packageType;

              table.push([
                isWinner ? pc.cyan(pc.bold(cand.provider)) : cand.provider,
                isWinner ? pc.bold(cand.appName) : cand.appName,
                cand.packageName,
                isWinner ? pc.green(pc.bold(cand.version)) : cand.version,
                format,
                status,
              ]);
            }

            console.log(table.toString() + '\n');
            logger.info(`Selected latest version ${pc.green(pc.bold(chosen.version))} from ${pc.cyan(pc.bold(chosen.provider))}`);
          },
          onProgress: (p: DownloadProgress) => {
            if (!bar) {
              bar = createDownloadProgressBar(app);
              bar.start(100, 0, {
                downloaded: '0 B',
                total: 'Resolving...',
                speed: '0 B/s',
                eta: '00:00',
              });
            }

            bar.update(p.percentage, {
              downloaded: formatBytes(p.bytesDownloaded),
              total: p.totalBytes > 0 ? formatBytes(p.totalBytes) : 'Unknown',
              speed: formatSpeed(p.speedBytesPerSec),
              eta: formatDuration(p.etaSeconds),
            });
          },
        } as any
      );

      if (bar) {
        bar.stop();
      }
      console.log('\n');

      logger.success(`APK Download Complete!`);
      console.log(`${pc.bold('File:')}     ${result.filePath}`);
      console.log(`${pc.bold('Size:')}     ${formatBytes(result.fileSizeBytes)}`);
      console.log(`${pc.bold('Type:')}     ${result.packageType}`);
      if (result.sha256) {
        console.log(`${pc.bold('SHA256:')}   ${pc.dim(result.sha256)} ${result.checksumVerified ? pc.green('✔ Verified') : ''}`);
      }
      if (result.durationMs > 0) {
        console.log(`${pc.bold('Time:')}     ${(result.durationMs / 1000).toFixed(1)}s`);
      }
    } catch (err: any) {
      console.log('\n');
      logger.error(`Download failed: ${err.message}`);
    }
  });
