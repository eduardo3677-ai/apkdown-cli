import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { isCI, isGitHubAction, getActionInputs } from '../src/utils/ci.js';

describe('CI and GitHub Action Environment Detection', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('should detect CI environment correctly', () => {
    process.env.CI = 'true';
    expect(isCI()).toBe(true);

    delete process.env.CI;
    process.env.GITHUB_ACTIONS = 'true';
    expect(isCI()).toBe(true);
  });

  it('should detect GitHub Action when INPUT_ID is set', () => {
    delete process.env.GITHUB_ACTIONS;
    delete process.env.INPUT_ID;
    expect(isGitHubAction()).toBe(false);

    process.env.INPUT_ID = 'org.telegram.messenger';
    expect(isGitHubAction()).toBe(true);
  });

  it('should parse action inputs with defaults', () => {
    process.env.INPUT_ID = 'org.videolan.vlc';
    process.env.INPUT_PROVIDER = 'fdroid,apkmirror';
    process.env.INPUT_EXCLUDE_PROVIDER = 'appgallery,aptoide';
    process.env.INPUT_ARCH = 'arm64-v8a';
    process.env.INPUT_VERSION = 'latest';
    process.env.INPUT_OUTPUT_DIR = './custom_out';

    const inputs = getActionInputs();
    expect(inputs).not.toBeNull();
    expect(inputs?.id).toBe('org.videolan.vlc');
    expect(inputs?.provider).toBe('fdroid,apkmirror');
    expect(inputs?.excludeProviders).toEqual(['appgallery', 'aptoide']);
    expect(inputs?.arch).toBe('arm64-v8a');
    expect(inputs?.outputDir).toContain('custom_out');
  });
});
