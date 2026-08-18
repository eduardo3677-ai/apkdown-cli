import { Command } from 'commander';
import pc from 'picocolors';
import { providerRegistry } from '../../providers/registry.js';
import { configManager } from '../../core/config.js';
import { ApkDownConfig } from '../../core/types.js';
import { logger } from '../ui/logger.js';
import { renderProvidersTable } from '../ui/table.js';

export const providersCommand = new Command('providers')
  .alias('p')
  .description('List, manage, and test APK providers')
  .option('-e, --enable <provider>', 'Enable a specific provider')
  .option('-d, --disable <provider>', 'Disable a specific provider')
  .option('-t, --test [provider]', 'Test connectivity and health of all or a specific provider')
  .option('--json', 'Output provider list or health test in JSON format', false)
  .action(async (options: any) => {
    if (options.enable) {
      const pName = options.enable.toLowerCase() as keyof ApkDownConfig['providers'];
      configManager.setProvider(pName, true);
      logger.success(`Provider "${options.enable}" enabled.`);
    }

    if (options.disable) {
      const pName = options.disable.toLowerCase() as keyof ApkDownConfig['providers'];
      configManager.setProvider(pName, false);
      logger.warn(`Provider "${options.disable}" disabled.`);
    }

    const currentConfig = configManager.getAll();
    const providers = providerRegistry.getAll();

    if (options.test !== undefined) {
      logger.info('Testing provider connectivity and search response latency...\n');
      const targetList = typeof options.test === 'string'
        ? providers.filter((p) => p.name.toLowerCase() === options.test.toLowerCase())
        : providers;

      const healthResults: Array<{ name: string; status: string; latencyMs: number; error?: string }> = [];

      for (const p of targetList) {
        const start = Date.now();
        try {
          const results = await p.search('telegram', { limit: 1 });
          const latency = Date.now() - start;
          healthResults.push({
            name: p.name,
            status: results.length > 0 ? 'healthy' : 'empty_results',
            latencyMs: latency,
          });
          console.log(`  ${pc.green('✔')} ${pc.bold(p.name.padEnd(14))} ${pc.green('ONLINE')} (${latency}ms, returned ${results.length} results)`);
        } catch (err: any) {
          const latency = Date.now() - start;
          healthResults.push({
            name: p.name,
            status: 'unreachable',
            latencyMs: latency,
            error: err.message,
          });
          console.log(`  ${pc.red('✖')} ${pc.bold(p.name.padEnd(14))} ${pc.red('OFFLINE')} (${err.message})`);
        }
      }

      if (options.json) {
        console.log(JSON.stringify(healthResults, null, 2));
      }
      return;
    }

    if (options.json) {
      const data = providers.map((p) => ({
        name: p.name,
        homepage: p.homepage,
        enabled: (currentConfig.providers as Record<string, boolean>)[p.name] !== false,
        supportsVersionHistory: p.supportsVersionHistory,
        supportsArchFiltering: p.supportsArchFiltering,
        supportsBeta: p.supportsBeta,
      }));
      console.log(JSON.stringify(data, null, 2));
      return;
    }

    console.log('\n' + pc.bold('Available APK Providers:') + '\n');
    console.log(renderProvidersTable(providers, currentConfig.providers) + '\n');
  });
