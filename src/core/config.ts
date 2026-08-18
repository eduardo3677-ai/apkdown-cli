import fs from 'fs';
import path from 'path';
import os from 'os';
import { z } from 'zod';
import { ApkDownConfig, Architecture, ReleaseChannel } from './types.js';
import { DEFAULT_CONFIG, SUPPORTED_ARCHITECTURES, RELEASE_CHANNELS } from './constants.js';

const ArchitectureSchema = z.enum(
  SUPPORTED_ARCHITECTURES as [Architecture, ...Architecture[]]
);

const ReleaseChannelSchema = z.enum(
  RELEASE_CHANNELS as [ReleaseChannel, ...ReleaseChannel[]]
);

export const ConfigSchema = z.object({
  downloadDir: z.string().default(DEFAULT_CONFIG.downloadDir),
  defaultProvider: z.string().default(DEFAULT_CONFIG.defaultProvider),
  preferredArch: ArchitectureSchema.default(DEFAULT_CONFIG.preferredArch),
  includeBeta: z.boolean().default(DEFAULT_CONFIG.includeBeta),
  defaultChannel: ReleaseChannelSchema.default(DEFAULT_CONFIG.defaultChannel),
  maxConcurrency: z.number().min(1).max(10).default(DEFAULT_CONFIG.maxConcurrency),
  timeoutMs: z.number().min(1000).max(120000).default(DEFAULT_CONFIG.timeoutMs),
  verifyChecksums: z.boolean().default(DEFAULT_CONFIG.verifyChecksums),
  userAgent: z.string().default(DEFAULT_CONFIG.userAgent),
  proxy: z.string().optional(),
  providers: z.object({
    aptoide: z.boolean().default(true),
    apkmirror: z.boolean().default(true),
    apkpure: z.boolean().default(true),
    apkcombo: z.boolean().default(true),
    fdroid: z.boolean().default(true),
    github: z.boolean().default(true),
    appgallery: z.boolean().default(true),
  }).default(DEFAULT_CONFIG.providers),
});

export class ConfigManager {
  private static instance: ConfigManager;
  private config: ApkDownConfig;
  private readonly configDir: string;
  private readonly configFilePath: string;

  private constructor() {
    const home = os.homedir();
    this.configDir = process.env.XDG_CONFIG_HOME
      ? path.join(process.env.XDG_CONFIG_HOME, 'apkdown')
      : path.join(home, '.config', 'apkdown');
    
    this.configFilePath = path.join(this.configDir, 'config.json');
    this.config = this.load();
  }

  public static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  public getConfigFilePath(): string {
    return this.configFilePath;
  }

  public getConfigDir(): string {
    return this.configDir;
  }

  private load(): ApkDownConfig {
    try {
      if (fs.existsSync(this.configFilePath)) {
        const raw = fs.readFileSync(this.configFilePath, 'utf-8');
        const parsed = JSON.parse(raw);
        const result = ConfigSchema.safeParse(parsed);
        if (result.success) {
          return result.data;
        }
        // If validation failed, merge with defaults
        return { ...DEFAULT_CONFIG, ...parsed };
      }
    } catch {
      // Fallback on error
    }
    return { ...DEFAULT_CONFIG };
  }

  public save(): void {
    try {
      if (!fs.existsSync(this.configDir)) {
        fs.mkdirSync(this.configDir, { recursive: true });
      }
      fs.writeFileSync(this.configFilePath, JSON.stringify(this.config, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to save config:', err);
    }
  }

  public getAll(): ApkDownConfig {
    return { ...this.config };
  }

  public get<K extends keyof ApkDownConfig>(key: K): ApkDownConfig[K] {
    return this.config[key];
  }

  public set<K extends keyof ApkDownConfig>(key: K, value: ApkDownConfig[K]): void {
    this.config[key] = value;
    this.save();
  }

  public setProvider(providerName: keyof ApkDownConfig['providers'], enabled: boolean): void {
    this.config.providers[providerName] = enabled;
    this.save();
  }

  public reset(): void {
    this.config = { ...DEFAULT_CONFIG };
    this.save();
  }
}

export const configManager = ConfigManager.getInstance();
