import * as p from '@clack/prompts';
import pc from 'picocolors';
import { providerRegistry } from '../providers/registry.js';
import { AppSearchResult, Architecture } from '../core/types.js';
import { configManager } from '../core/config.js';
import { formatDownloads, formatRating } from '../utils/formatting.js';

export async function runSearchScreen(): Promise<AppSearchResult | null> {
  const config = configManager.getAll();

  const query = await p.text({
    message: 'What app would you like to search for?',
    placeholder: 'e.g. WhatsApp, Spotify, Telegram, VLC, Termux, ReVanced...',
    validate: (val) => {
      if (!val || val.trim().length === 0) return 'Please enter an app name or keyword';
    },
  });

  if (p.isCancel(query)) return null;

  const provider = await p.select({
    message: 'Select search source:',
    options: [
      { value: 'all', label: 'All Enabled Providers (Aggregated)', hint: 'recommended' },
      { value: 'aptoide', label: 'Aptoide', hint: 'Fast, verified hashes' },
      { value: 'apkmirror', label: 'APKMirror', hint: 'All versions & multi-arch variants' },
      { value: 'apkpure', label: 'APKPure', hint: 'APK & XAPK bundles' },
      { value: 'apkcombo', label: 'APKCombo', hint: 'Direct Cloudflare fast links' },
      { value: 'fdroid', label: 'F-Droid', hint: 'Verified Open Source FOSS' },
      { value: 'github', label: 'GitHub Releases', hint: 'Open Source GitHub Apps' },
      { value: 'appgallery', label: 'Huawei AppGallery', hint: 'Huawei Ecosystem' },
    ],
    initialValue: config.defaultProvider || 'all',
  });

  if (p.isCancel(provider)) return null;

  const includeBeta = await p.confirm({
    message: 'Include Beta, Alpha, and Insider preview releases?',
    initialValue: config.includeBeta,
  });

  if (p.isCancel(includeBeta)) return null;

  const spinner = p.spinner();
  spinner.start(`Searching for "${query}" on ${provider}...`);

  try {
    const results = await providerRegistry.search({
      query: query as string,
      provider: provider as string,
      limit: 15,
      includeBeta: includeBeta as boolean,
      arch: config.preferredArch,
    });

    spinner.stop(`Found ${results.length} matching applications.`);

    if (results.length === 0) {
      p.note('No APKs were found matching your search. Try another keyword or provider.');
      return null;
    }

    const selectedAppId = await p.select({
      message: 'Select an application:',
      options: results.map((r) => {
        const rating = r.rating ? ` ★${r.rating.toFixed(1)}` : '';
        const providerTag = `[${r.provider}]`;
        return {
          value: `${r.provider}::${r.id}`,
          label: `${pc.bold(r.name)} ${pc.dim(`(${r.packageName || r.id})`)}`,
          hint: `${pc.cyan(providerTag)} v${r.version || 'Latest'}${rating}`,
        };
      }),
    });

    if (p.isCancel(selectedAppId)) return null;

    const [pName, id] = (selectedAppId as string).split('::');
    return results.find((r) => r.provider === pName && r.id === id) || null;
  } catch (err: any) {
    spinner.stop('Search failed.');
    p.note(`Error: ${err.message}`, 'Search Error');
    return null;
  }
}
