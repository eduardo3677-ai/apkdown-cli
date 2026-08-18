import Table from 'cli-table3';
import pc from 'picocolors';
import { AppDetails, AppSearchResult, AppVariant } from '../../core/types.js';
import { BaseProvider } from '../../providers/base.js';
import { formatDownloads, formatRating } from '../../utils/formatting.js';

export function renderSearchResultsTable(results: AppSearchResult[]): string {
  const table = new Table({
    head: [
      pc.cyan('#'),
      pc.cyan('Name'),
      pc.cyan('Package / ID'),
      pc.cyan('Version'),
      pc.cyan('Provider'),
      pc.cyan('Rating'),
      pc.cyan('Downloads'),
    ],
    style: { head: [], border: ['grey'] },
    colWidths: [4, 25, 30, 15, 14, 10, 12],
    wordWrap: true,
  });

  results.forEach((r, idx) => {
    const providerColor =
      r.provider === 'aptoide'
        ? pc.green(r.provider)
        : r.provider === 'apkmirror'
        ? pc.yellow(r.provider)
        : r.provider === 'apkpure'
        ? pc.blue(r.provider)
        : r.provider === 'fdroid'
        ? pc.magenta(r.provider)
        : r.provider === 'apkcombo'
        ? pc.cyan(r.provider)
        : pc.white(r.provider);

    table.push([
      pc.gray((idx + 1).toString()),
      pc.bold(r.name),
      pc.dim(r.packageName || r.id),
      r.version || 'Latest',
      providerColor,
      formatRating(r.rating),
      formatDownloads(r.downloads),
    ]);
  });

  return table.toString();
}

export function renderVariantsTable(variants: AppVariant[]): string {
  const table = new Table({
    head: [
      pc.cyan('#'),
      pc.cyan('Version'),
      pc.cyan('Arch'),
      pc.cyan('Format'),
      pc.cyan('Channel'),
      pc.cyan('Size'),
      pc.cyan('Min Android'),
    ],
    style: { head: [], border: ['grey'] },
  });

  variants.forEach((v, idx) => {
    const channelBadge =
      v.releaseChannel === 'beta' || v.isBeta
        ? pc.yellow('[BETA]')
        : v.releaseChannel === 'alpha'
        ? pc.red('[ALPHA]')
        : v.releaseChannel === 'preview' || v.releaseChannel === 'insider'
        ? pc.magenta(`[${v.releaseChannel.toUpperCase()}]`)
        : pc.green('[STABLE]');

    const archColor =
      v.architecture === 'arm64-v8a'
        ? pc.cyan(v.architecture)
        : v.architecture === 'universal'
        ? pc.white(v.architecture)
        : pc.yellow(v.architecture);

    table.push([
      pc.gray((idx + 1).toString()),
      pc.bold(v.versionName),
      archColor,
      pc.magenta(v.packageType),
      channelBadge,
      v.fileSizeFormatted || 'N/A',
      pc.dim(v.minAndroid || 'Any'),
    ]);
  });

  return table.toString();
}

export function renderProvidersTable(providers: BaseProvider[], enabledMap: Record<string, boolean>): string {
  const table = new Table({
    head: [pc.cyan('Provider'), pc.cyan('Status'), pc.cyan('Beta'), pc.cyan('Arch Filter'), pc.cyan('Description')],
    style: { head: [], border: ['grey'] },
    colWidths: [16, 12, 10, 14, 45],
    wordWrap: true,
  });

  providers.forEach((p) => {
    const isEnabled = enabledMap[p.name] !== false;
    const status = isEnabled ? pc.green('✔ Enabled') : pc.red('✖ Disabled');
    const beta = p.supportsBeta ? pc.green('Yes') : pc.dim('No');
    const arch = p.supportsArchFiltering ? pc.green('Yes') : pc.dim('No');

    table.push([pc.bold(p.name), status, beta, arch, pc.dim(p.description)]);
  });

  return table.toString();
}
