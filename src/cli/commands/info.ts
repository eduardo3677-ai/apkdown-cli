import { Command } from 'commander';
import pc from 'picocolors';
import boxen from 'boxen';
import { providerRegistry } from '../../providers/registry.js';
import { Architecture } from '../../core/types.js';
import { isArchCompatible } from '../../utils/arch.js';
import { logger } from '../ui/logger.js';
import { renderVariantsTable } from '../ui/table.js';
import { formatDownloads, formatRating } from '../../utils/formatting.js';

export const infoCommand = new Command('info')
  .alias('i')
  .description('Display detailed metadata and variant breakdown for an APK with architecture filtering')
  .argument('<app>', 'App name, package name, or ID')
  .option('-p, --provider <provider>', 'Provider to inspect (aptoide, apkmirror, apkpure, apkcombo, fdroid, izzyondroid, github, appgallery)', 'aptoide')
  .option('-a, --arch <architecture>', 'Filter variants by architecture (arm64-v8a, armeabi-v7a, x86, x86_64, universal, all)')
  .action(async (app: string, options: any) => {
    logger.info(`Fetching details for "${pc.bold(app)}" from ${pc.cyan(options.provider)}...`);

    const provider = providerRegistry.get(options.provider);
    if (!provider) {
      logger.error(`Unknown provider: "${options.provider}"`);
      return;
    }

    try {
      const details = await provider.getAppDetails(app);

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

      let variantsToDisplay = details.variants;
      if (options.arch && options.arch !== 'all') {
        const targetArch = options.arch as Architecture;
        variantsToDisplay = details.variants.filter((v) => isArchCompatible(v.architecture, targetArch));
        logger.info(`Filtering variants for CPU architecture: ${pc.cyan(pc.bold(targetArch))} (matched ${variantsToDisplay.length}/${details.variants.length})`);
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
      logger.error(`Failed to get app details: ${err.message}`);
    }
  });

export const versionsCommand = new Command('versions')
  .alias('v')
  .description('List all available releases and architecture variants for an application')
  .argument('<app>', 'App name or package name')
  .option('-p, --provider <provider>', 'Provider to inspect', 'aptoide')
  .option('-a, --arch <architecture>', 'Filter variants by architecture (arm64-v8a, armeabi-v7a, x86, x86_64, universal, all)')
  .action(async (app: string, options: any) => {
    const provider = providerRegistry.get(options.provider);
    if (!provider) {
      logger.error(`Unknown provider: "${options.provider}"`);
      return;
    }

    try {
      const details = await provider.getAppDetails(app);
      let variantsToDisplay = details.variants;
      if (options.arch && options.arch !== 'all') {
        variantsToDisplay = details.variants.filter((v) => isArchCompatible(v.architecture, options.arch as Architecture));
      }

      console.log(`\n${pc.bold(details.name)} (${details.packageName}) - Variants:\n`);
      console.log(renderVariantsTable(variantsToDisplay) + '\n');
    } catch (err: any) {
      logger.error(`Failed to retrieve versions: ${err.message}`);
    }
  });
