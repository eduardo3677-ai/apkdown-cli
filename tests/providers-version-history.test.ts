import { describe, expect, it } from 'vitest';
import { BaseProvider } from '../src/providers/base.js';
import { providerRegistry } from '../src/providers/registry.js';
import { AppDetails, AppSearchResult, ProviderSearchOptions } from '../src/core/types.js';
import { FDroidProvider } from '../src/providers/fdroid.js';
import { IzzyOnDroidProvider } from '../src/providers/izzyondroid.js';
import { APKPureProvider } from '../src/providers/apkpure.js';
import { APKMirrorProvider } from '../src/providers/apkmirror.js';

class MockHistoryProvider extends BaseProvider {
  public readonly name = 'mock-history';
  public readonly displayName = 'Mock History';
  public readonly description = 'Mock provider';
  public readonly homepage = 'https://example.test';
  public override readonly supportsVersionHistory = true;

  async search(_query: string, _options?: ProviderSearchOptions): Promise<AppSearchResult[]> {
    return [
      { id: 'release-2', versionId: '2', name: 'Exact v2', packageName: 'org.example.app', version: '2.0.0', provider: this.name },
      { id: 'release-1', versionId: '1', name: 'Exact v1', packageName: 'org.example.app', version: '1.0.0', provider: this.name },
      { id: 'fork', versionId: '9', name: 'Fork', packageName: 'org.example.app.fork', version: '9.0.0', provider: this.name },
    ];
  }

  async getAppDetails(): Promise<AppDetails> {
    return {
      id: 'org.example.app',
      name: 'Exact',
      packageName: 'org.example.app',
      provider: this.name,
      latestVersion: '2.0.0',
      variants: [
        { id: 'v2', versionId: '2', versionName: '2.0.0', versionCode: 2, architecture: 'universal', packageType: 'APK', isBeta: false, releaseChannel: 'stable' },
        { id: 'v1', versionId: '1', versionName: '1.0.0', versionCode: 1, architecture: 'universal', packageType: 'APK', isBeta: false, releaseChannel: 'stable' },
      ],
      hasVersionHistory: true,
    };
  }
}

const response = (data: any) => ({ status: 200, headers: {}, data, finalUrl: 'https://example.test' });

describe('Provider version history contract', () => {
  it('keeps every release for an exact package and rejects prefix packages', async () => {
    providerRegistry.register(new MockHistoryProvider());
    const results = await providerRegistry.search({ query: 'org.example.app', provider: 'mock-history' });

    expect(results.map((result) => result.versionId)).toEqual(['2', '1']);
    expect(results.every((result) => result.packageName === 'org.example.app')).toBe(true);
  });

  it('loads exact version histories through the registry', async () => {
    providerRegistry.register(new MockHistoryProvider());
    const histories = await providerRegistry.getVersionHistories({ query: 'org.example.app', provider: 'mock-history' });

    expect(histories).toHaveLength(1);
    expect(histories[0].variants.map((variant) => variant.versionId)).toEqual(['2', '1']);
  });

  it('maps and sorts every F-Droid package release using native version codes and apkName', async () => {
    const http = {
      get: async () => response({
        packageName: 'org.example.app',
        name: 'Example',
        packages: [
          { versionName: '1.0.0', versionCode: 10, apkName: 'custom-old.apk', size: 10 },
          { versionName: '2.0.0', versionCode: 20, apkName: 'custom-new.apk', size: 20 },
        ],
      }),
    } as any;
    const details = await new FDroidProvider(http).getAppDetails('org.example.app');

    expect(details.variants.map((variant) => variant.versionId)).toEqual(['20', '10']);
    expect(details.variants[0].downloadUrl).toBe('https://f-droid.org/repo/custom-new.apk');
    expect(details.hasVersionHistory).toBe(true);
  });

  it('reads IzzyOnDroid history from index-v2 with real version names and hashes', async () => {
    const http = {
      get: async () => response({
        packages: {
          'org.example.app': {
            metadata: { name: { 'en-US': 'Example' }, summary: { 'en-US': 'Summary' } },
            versions: {
              oldhash: { added: 1, file: { name: '/old.apk', sha256: 'oldhash', size: 10 }, manifest: { versionName: '1.0.0', versionCode: 10 } },
              newhash: { added: 2, file: { name: '/new.apk', sha256: 'newhash', size: 20 }, manifest: { versionName: '2.0.0', versionCode: 20, nativecode: ['arm64-v8a'] } },
            },
          },
        },
      }),
    } as any;
    const details = await new IzzyOnDroidProvider(http).getAppDetails('org.example.app');

    expect(details.variants.map((variant) => variant.versionName)).toEqual(['2.0.0', '1.0.0']);
    expect(details.variants[0].versionId).toBe('20');
    expect(details.variants[0].releaseId).toBe('newhash');
    expect(details.variants[0].downloadUrl).toBe('https://apt.izzysoft.de/fdroid/repo/new.apk');
  });


  it('keeps only the canonical APKMirror app across paginated exact-package results', async () => {
    const page1 = `
      <div class="appRow"><h5 class="appRowTitle"><a class="fontBlack" href="/apk/dev/app/app-2-0-20-release/">App 2.0 (20)</a></h5></div>
      <a class="nextpostslink" href="/page-2">Next</a>`;
    const page2 = `
      <div class="appRow"><h5 class="appRowTitle"><a class="fontBlack" href="/apk/dev/app/app-1-0-10-release/">App 1.0 (10)</a></h5></div>
      <div class="appRow"><h5 class="appRowTitle"><a class="fontBlack" href="/apk/other/fork/fork-9-0-90-release/">Fork 9.0 (90)</a></h5></div>`;
    const http = {
      get: async (url: string) => response(url.includes('page-2') ? page2 : page1),
    } as any;
    const results = await new APKMirrorProvider(http).search('org.example.app', { limit: 10 });

    expect(results.map((result) => result.versionId)).toEqual(['20', '10']);
    expect(results.every((result) => result.packageName === 'org.example.app')).toBe(true);
  });


  it('parses APKPure old-version rows with native version codes and direct version URLs', async () => {
    const mainHtml = `<html><body><h1>Example</h1><script>window.apkpure={pageData:{"versionName":"2.0.0","versionCode":20}}</script></body></html>`;
    const downloadHtml = `<a href="https://d.apkpure.com/b/APK/org.example.app?versionCode=20&nc=arm64-v8a&sv=23">2.0.0</a>`;
    const versionsHtml = `<div class="ver_download_link" data-dt-version="2.0.0" data-dt-versioncode="20" data-dt-apkid="b/APK/new" data-dt-filesize="200"></div>
      <div class="ver_download_link" data-dt-version="1.0.0" data-dt-versioncode="10" data-dt-apkid="b/APK/old" data-dt-filesize="100"></div>`;
    const http = {
      get: async (url: string) => response(url.endsWith('/versions') ? versionsHtml : url.endsWith('/download') ? downloadHtml : mainHtml),
    } as any;
    const details = await new APKPureProvider(http).getVersionHistory('https://apkpure.com/example/org.example.app');

    expect(details.variants.map((variant) => variant.versionId)).toEqual(['20', '10']);
    expect(details.variants[1].downloadUrl).toBe('https://d.apkpure.com/b/APK/org.example.app?versionCode=10');
    expect(details.hasVersionHistory).toBe(true);
  });

  it('uses APKPure pageData version fields instead of parsing file sizes as versions', async () => {
    const mainHtml = `
      <html><body><h1>Example</h1><script>
      window.apkpure = {pageData: {"packageName":"org.example.app","versionName":"2.0.3","versionCode":41}}
      </script><a>Download APK (39.0 MB)</a></body></html>`;
    const downloadHtml = `<a href="https://d.apkpure.com/b/APK/org.example.app?versionCode=41&nc=arm64-v8a&sv=23">2.0.3 (20 MB)</a>`;
    const http = {
      get: async (url: string) => response(url.endsWith('/download') ? downloadHtml : mainHtml),
    } as any;
    const details = await new APKPureProvider(http).getAppDetails('https://apkpure.com/example/org.example.app');

    expect(details.latestVersion).toBe('2.0.3');
    expect(details.variants[0].versionId).toBe('41');
    expect(details.variants[0].versionName).toBe('2.0.3');
  });
});
