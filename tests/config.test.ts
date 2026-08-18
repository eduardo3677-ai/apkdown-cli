import { describe, it, expect } from 'vitest';
import { configManager } from '../src/core/config.js';
import { DEFAULT_CONFIG } from '../src/core/constants.js';

describe('ConfigManager', () => {
  it('should initialize with valid defaults', () => {
    const config = configManager.getAll();
    expect(config.defaultProvider).toBe(DEFAULT_CONFIG.defaultProvider);
    expect(config.preferredArch).toBe(DEFAULT_CONFIG.preferredArch);
    expect(config.providers.aptoide).toBe(true);
    expect(config.providers.apkmirror).toBe(true);
  });

  it('should get and set configuration values', () => {
    configManager.set('preferredArch', 'x86_64');
    expect(configManager.get('preferredArch')).toBe('x86_64');

    configManager.set('preferredArch', 'arm64-v8a');
    expect(configManager.get('preferredArch')).toBe('arm64-v8a');
  });

  it('should toggle provider settings', () => {
    configManager.setProvider('aptoide', false);
    expect(configManager.getAll().providers.aptoide).toBe(false);

    configManager.setProvider('aptoide', true);
    expect(configManager.getAll().providers.aptoide).toBe(true);
  });
});
