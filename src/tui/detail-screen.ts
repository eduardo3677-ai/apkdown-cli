import * as p from '@clack/prompts';
import pc from 'picocolors';
import { providerRegistry } from '../providers/registry.js';
import { AppDetails, AppSearchResult, AppVariant } from '../core/types.js';
import { configManager } from '../core/config.js';
import { formatDownloads, formatRating } from '../utils/formatting.js';

export async function runDetailScreen(
  appRef: AppSearchResult
): Promise<{ details: AppDetails; variant: AppVariant } | null> {
  const provider = providerRegistry.get(appRef.provider);
  if (!provider) {
    p.note(`Provider "${appRef.provider}" is not available.`);
    return null;
  }

  const spinner = p.spinner();
  spinner.start(`Loading details for ${appRef.name}...`);

  try {
    const details = await provider.getAppDetails(appRef.id);
    spinner.stop(`Loaded app details.`);

    const config = configManager.getAll();
    const infoLines = [
      `${pc.bold('Package:')}     ${details.packageName}`,
      `${pc.bold('Developer:')}   ${details.developer || 'Unknown'}`,
      `${pc.bold('Provider:')}    ${pc.green(details.provider)}`,
      `${pc.bold('Rating:')}      ${formatRating(details.rating)}`,
      `${pc.bold('Downloads:')}   ${formatDownloads(details.downloads)}`,
      `${pc.bold('Variants:')}    ${details.variants.length} available`,
    ];

    if (details.description) {
      infoLines.push('', pc.dim(details.description.slice(0, 200) + (details.description.length > 200 ? '...' : '')));
    }

    p.note(infoLines.join('\n'), details.name);

    if (details.variants.length === 0) {
      p.note('No downloadable APK variants found for this application.');
      return null;
    }

    // Select variant
    const variantId = await p.select({
      message: 'Choose version & architecture variant:',
      options: details.variants.map((v) => {
        const isPref = v.architecture === config.preferredArch ? pc.green(' (Preferred Arch)') : '';
        const betaTag = v.isBeta ? pc.yellow(` [${v.releaseChannel.toUpperCase()}]`) : pc.green(' [STABLE]');
        const sizeTag = v.fileSizeFormatted ? ` (${v.fileSizeFormatted})` : '';

        return {
          value: v.id,
          label: `${pc.bold(v.versionName)} - ${v.packageType} - ${pc.cyan(v.architecture)}${isPref}`,
          hint: `${betaTag}${sizeTag} ${v.minAndroid ? `Min: ${v.minAndroid}` : ''}`,
        };
      }),
    });

    if (p.isCancel(variantId)) return null;

    const chosenVariant = details.variants.find((v) => v.id === variantId);
    if (!chosenVariant) return null;

    return { details, variant: chosenVariant };
  } catch (err: any) {
    spinner.stop('Failed to load app details.');
    p.note(`Error: ${err.message}`, 'Details Error');
    return null;
  }
}
