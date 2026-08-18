import { Command } from 'commander';
import pc from 'picocolors';
import boxen from 'boxen';
import { providerRegistry } from '../../providers/registry.js';
import { Architecture } from '../../core/types.js';
import { isArchCompatible } from '../../utils/arch.js';
import { logger } from '../ui/logger.js';
import { renderVariantsTable, renderVersionHistoryTable } from '../ui/table.js';
import { formatDownloads, formatRating } from '../../utils/formatting.js';

export const infoCommand = new Command('info')
  .alias('i')
  .description('Display detailed metadata and variant breakdown for an APK with architecture filtering')
  .argument('<app>', 'App name, package name, or ID')
  .option('-p, --provider <provider>', 'Provider to inspect (aptoide, apkmirror, apkpure, apkcombo, fdroid, izzyondroid, github, appgallery)', 'aptoide')
  .option('-a, --arch <architecture>', 'Filter variants by architecture (arm64-v8a, armeabi-v7a, x86, x86_64, universal, all)')
  .option('--json', 'Output metadata and variant breakdown in JSON format', false)
  .action(async (app: string, options: any) => {
    if (!options.json) {
      logger.info(`Fetching details for "${pc.bold(app)}" from ${pc.cyan(options.provider)}...`);
    }

    const provider = providerRegistry.get(options.provider);
    if (!provider) {
      if (options.json) {
        console.error(JSON.stringify({ error: `Unknown provider: "${options.provider}"` }));
      } else {
        logger.error(`Unknown provider: "${options.provider}"`);
      }
      return;
    }

    try {
      const isPackageId = /^[a-zA-Z][a-zA-Z0-9_]*\.[a-zA-Z0-9_]+(\.[a-zA-Z0-9_]+)*$/.test(app.trim());
      const details = isPackageId && provider.supportsVersionHistory
        ? await provider.getVersionHistory(app)
        : await provider.getAppDetails(app);

      let variantsToDisplay = details.variants;
      if (options.arch && options.arch !== 'all') {
        const targetArch = options.arch as Architecture;
        variantsToDisplay = details.variants.filter((v) => isArchCompatible(v.architecture, targetArch));
      }

      if (options.json) {
        console.log(JSON.stringify({ ...details, variants: variantsToDisplay }, null, 2));
        return;
      }

      const infoBox = `${pc.bold(pc.cyan(details.name))}
${pc.dim(details.packageName)}

${pc.bold('Developer:')}   ${details.developer || 'N/A'}
${pc.bold('Provider:')}    ${pc.green(details.provider)}
${pc.bold('Latest:')}      ${pc.yellow(details.latestVersion || 'N/A')}
${pc.bold('Rating:')}      ${formatRating(details.rating)}
${pc.bold('Downloads:')}   ${formatDownloads(details.downloads)}
${pc.bold('Source URL:')}  ${pc.blue(details.sourceUrl || 'N/A')}

${pc.bold('Description:')}
${details.description ? details.description.slice(0, 300) + (details.description.length > 300 ? '...' : '') : 'No description provided.'}`;

      console.log('\n' + boxen(infoBox, { padding: 1, borderStyle: 'round', borderColor: 'cyan' }) + '\n');

      if (options.arch && options.arch !== 'all') {
        logger.info(`Filtering variants for CPU architecture: ${pc.cyan(pc.bold(options.arch))} (matched ${variantsToDisplay.length}/${details.variants.length})`);
      }

      if (variantsToDisplay.length > 0) {
        console.log(pc.bold('Available Variants & Architectures:'));
        console.log(renderVariantsTable(variantsToDisplay) + '\n');
      } else {
        logger.warn(`No variants found matching architecture "${options.arch}". Total variants available: ${details.variants.length}`);
      }

      if (details.permissions && details.permissions.length > 0) {
        console.log(pc.bold(`Requested Permissions (${details.permissions.length}):`));
        console.log(pc.dim(details.permissions.slice(0, 10).join('\n')));
        if (details.permissions.length > 10) {
          console.log(pc.dim(`... and ${details.permissions.length - 10} more permissions`));
        }
        console.log('\n');
      }
    } catch (err: any) {
      if (options.json) {
        console.error(JSON.stringify({ error: err.message }));
      } else {
        logger.error(`Failed to get app details: ${err.message}`);
      }
    }
  });

export const versionsCommand = new Command('versions')
  .alias('v')
  .description('List every historical release exposed by compatible providers')
  .argument('<app>', 'Exact Android package name, app name, or provider ID')
  .option('-p, --provider <provider>', 'Provider to inspect, comma-separated providers, or all', 'all')
  .option('-a, --arch <architecture>', 'Filter variants by architecture (arm64-v8a, armeabi-v7a, x86, x86_64, universal, all)')
  .option('--json', 'Output version histories in JSON format', false)
  .action(async (app: string, options: any) => {
    try {
      const histories = await providerRegistry.getVersionHistories({
        query: app,
        provider: options.provider,
      });

      const filtered = histories.map((details) => ({
        ...details,
        variants: options.arch && options.arch !== 'all'
          ? details.variants.filter((variant) => isArchCompatible(variant.architecture, options.arch as Architecture))
          : details.variants,
      })).filter((details) => details.variants.length > 0);

      if (options.json) {
        if (options.provider !== 'all' && !options.provider.includes(',')) {
          console.log(JSON.stringify(filtered[0]?.variants || [], null, 2));
        } else {
          console.log(JSON.stringify(filtered, null, 2));
        }
        return;
      }

      if (filtered.length === 0) {
        logger.warn(`No version history found for "${app}" on the selected compatible providers.`);
        return;
      }

      const totalVersions = filtered.reduce((sum, details) => sum + details.variants.length, 0);
      console.log(`\n${pc.bold(app)} - ${totalVersions} version/architecture entries from ${filtered.length} provider(s):\n`);
      console.log(renderVersionHistoryTable(filtered) + '\n');
    } catch (err: any) {
      if (options.json) {
        console.error(JSON.stringify({ error: err.message }));
      } else {
        logger.error(`Failed to retrieve versions: ${err.message}`);
      }
    }
  });
