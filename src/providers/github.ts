import { BaseProvider } from './base.js';
import {
  AppDetails,
  AppSearchResult,
  AppVariant,
  ProviderSearchOptions,
} from '../core/types.js';
import { ProviderError } from '../core/errors.js';
import { formatBytes } from '../utils/formatting.js';
import { detectReleaseChannel, normalizeArch } from '../utils/arch.js';

export class GitHubProvider extends BaseProvider {
  public readonly name = 'github';
  public readonly displayName = 'GitHub Releases';
  public readonly description = 'Direct releases from open-source GitHub Android repositories with prerelease & multi-arch APKs';
  public readonly homepage = 'https://github.com';
  public override readonly supportsVersionHistory = true;

  private baseUrl = 'https://api.github.com';

  // Popular curated Android open source apps on GitHub
  private curatedRepos: Record<string, { repo: string; name: string; desc: string }> = {
    revanced: { repo: 'ReVanced/revanced-manager', name: 'ReVanced Manager', desc: 'Application to manage and patch Android apps' },
    newpipe: { repo: 'TeamNewPipe/NewPipe', name: 'NewPipe', desc: 'A libre lightweight streaming frontend for Android' },
    mihon: { repo: 'mihonapp/mihon', name: 'Mihon (Tachiyomi)', desc: 'Free and open source manga reader for Android' },
    seal: { repo: 'JunkFood02/Seal', name: 'Seal', desc: 'Video and audio downloader based on yt-dlp' },
    termux: { repo: 'termux/termux-app', name: 'Termux', desc: 'Terminal emulator and Linux environment for Android' },
    spotube: { repo: 'KRTirtho/spotube', name: 'Spotube', desc: 'Open source Spotify client without ads' },
    vimusic: { repo: 'vfsfitvnm/ViMusic', name: 'ViMusic', desc: 'An Android application for streaming music from YouTube Music' },
    innertune: { repo: 'z-huang/InnerTune', name: 'InnerTune', desc: 'Material 3 YouTube Music client for Android' },
    koreader: { repo: 'koreader/koreader', name: 'KOReader', desc: 'An ebook reader application supporting PDF, DJVU, EPUB, FB2' },
    libretube: { repo: 'libre-tube/LibreTube', name: 'LibreTube', desc: 'Alternative YouTube frontend powered by Piped' },
    antennapod: { repo: 'AntennaPod/AntennaPod', name: 'AntennaPod', desc: 'Open-source podcast manager and player' },
    keepassdx: { repo: 'Kunzisoft/KeePassDX', name: 'KeePassDX', desc: 'Lightweight password manager for Android' },
    tachiyomi: { repo: 'mihonapp/mihon', name: 'Mihon (Tachiyomi)', desc: 'Free and open source manga reader for Android' },
  };

  public async search(query: string, options: ProviderSearchOptions = {}): Promise<AppSearchResult[]> {
    const qLower = query.toLowerCase().trim();
    const results: AppSearchResult[] = [];

    const isPackageId = /^[a-zA-Z][a-zA-Z0-9_]*\.[a-zA-Z0-9_]+(\.[a-zA-Z0-9_]+)*$/.test(query.trim());
    if (isPackageId && !this.curatedRepos[qLower]) {
      return [];
    }

    // 1. Check curated list first
    for (const [key, info] of Object.entries(this.curatedRepos)) {
      if (
        key.includes(qLower) ||
        info.name.toLowerCase().includes(qLower) ||
        info.repo.toLowerCase().includes(qLower)
      ) {
        if (!results.some((r) => r.id === info.repo)) {
          results.push({
            id: info.repo,
            name: info.name,
            packageName: info.repo,
            developer: info.repo.split('/')[0],
            version: 'Latest',
            description: info.desc,
            provider: this.name,
            sourceUrl: `https://github.com/${info.repo}`,
          });
        }
      }
    }

    // 2. Query GitHub Search API for android repos
    try {
      const searchUrl = `${this.baseUrl}/search/repositories?q=${encodeURIComponent(query)}+language:Kotlin+language:Java+topic:android&per_page=${options.limit || 8}`;
      const res = await this.http.get(searchUrl, {
        headers: {
          Accept: 'application/vnd.github+json',
          'User-Agent': 'apkdown-cli/1.0.0',
        },
      });

      const items = res.data?.items || [];
      for (const item of items) {
        if (!results.some((r) => r.id === item.full_name)) {
          results.push({
            id: item.full_name,
            name: item.name,
            packageName: item.full_name,
            developer: item.owner?.login || 'GitHub Dev',
            version: 'Latest',
            iconUrl: item.owner?.avatar_url,
            description: item.description || `GitHub Android repo ${item.full_name}`,
            provider: this.name,
            rating: item.stargazers_count ? Number((item.stargazers_count / 1000).toFixed(1)) : undefined,
            downloads: item.stargazers_count ? `${item.stargazers_count} stars` : undefined,
            sourceUrl: item.html_url,
            updatedAt: item.updated_at,
          });
        }
      }
    } catch {
      // Return curated results on rate-limit or network error
    }

    return results.slice(0, options.limit || 10);
  }

  public async getAppDetails(repoOrId: string): Promise<AppDetails> {
    let repo = repoOrId.trim();
    if (this.curatedRepos[repo.toLowerCase()]) {
      repo = this.curatedRepos[repo.toLowerCase()].repo;
    }

    const cleanRepo = repo.replace('https://github.com/', '').replace(/^\//, '');
    const releasesUrl = `${this.baseUrl}/repos/${cleanRepo}/releases`;

    try {
      const res = await this.http.get(releasesUrl, {
        headers: {
          Accept: 'application/vnd.github+json',
          'User-Agent': 'apkdown-cli/1.0.0',
        },
      });

      const releases = Array.isArray(res.data) ? res.data : [];
      if (releases.length === 0) {
        throw new ProviderError(this.name, `No releases found for GitHub repo ${cleanRepo}`);
      }

      const variants: AppVariant[] = [];

      for (const release of releases) {
        const tagName = release.tag_name || release.name || 'vLatest';
        const isPrerelease = release.prerelease || false;
        const { isBeta, channel } = detectReleaseChannel(tagName, release.body || '');
        const effectiveBeta = isPrerelease || isBeta;

        const apkAssets = (release.assets || []).filter(
          (a: any) => a.name.endsWith('.apk') || a.name.endsWith('.xapk')
        );

        for (const asset of apkAssets) {
          const architecture = normalizeArch(asset.name);
          variants.push({
            id: `gh-${asset.id}`,
            versionId: release.id != null ? String(release.id) : tagName,
            releaseId: release.id != null ? String(release.id) : tagName,
            versionName: tagName,
            architecture,
            packageType: asset.name.endsWith('.xapk') ? 'XAPK' : 'APK',
            fileSizeBytes: asset.size,
            fileSizeFormatted: asset.size ? formatBytes(asset.size) : undefined,
            downloadUrl: asset.browser_download_url,
            isBeta: effectiveBeta,
            releaseChannel: effectiveBeta ? (channel === 'stable' ? 'beta' : channel) : 'stable',
            releaseDate: release.published_at ? release.published_at.split('T')[0] : undefined,
            metadata: {
              downloadCount: asset.download_count,
              releaseNotes: release.body,
            },
          });
        }
      }

      if (variants.length === 0) {
        throw new ProviderError(this.name, `No APK assets attached in releases for ${cleanRepo}`);
      }

      const owner = cleanRepo.split('/')[0];
      const repoName = cleanRepo.split('/')[1] || cleanRepo;

      return {
        id: cleanRepo,
        name: repoName,
        packageName: cleanRepo,
        developer: owner,
        description: releases[0]?.body || `GitHub repository for ${cleanRepo}`,
        provider: this.name,
        sourceUrl: `https://github.com/${cleanRepo}`,
        latestVersion: variants[0]?.versionName || 'Latest',
        variants,
        hasVersionHistory: new Set(variants.map((variant) => variant.releaseId || variant.versionName)).size > 1,
      };
    } catch (err: any) {
      throw new ProviderError(this.name, `Failed to retrieve GitHub details: ${err.message}`, err);
    }
  }

  public override async resolveDownloadUrl(variant: AppVariant): Promise<string> {
    if (variant.downloadUrl) {
      return variant.downloadUrl;
    }
    throw new ProviderError(this.name, `Missing download URL for variant ${variant.id}`);
  }
}
