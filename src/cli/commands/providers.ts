import { Command } from 'commander';
import pc from 'picocolors';
import { providerRegistry } from '../../providers/registry.js';
import { configManager } from '../../core/config.js';
import { ApkDownConfig } from '../../core/types.js';
import { logger } from '../ui/logger.js';
import { renderProvidersTable } from '../ui/table.js';

export const providersCommand = new Command('providers')
  .alias('p')
  .description('List and manage APK providers and status')
  .option('-e, --enable <provider>', 'Enable a specific provider')
  .option('-d, --disable <provider>', 'Disable a specific provider')
  .action(async (options: any) => {
    const config = configManager.getAll();

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

    console.log('\n' + pc.bold('Available APK Providers:') + '\n');
    console.log(renderProvidersTable(providers, currentConfig.providers) + '\n');
  });

export const configCommand = new Command('config')
  .alias('c')
  .description('View and update apkdown-cli configuration options')
  .argument('[action]', 'Action to perform: get, set, list, reset', 'list')
  .argument('[key]', 'Configuration key to read or update')
  .argument('[value]', 'New value to assign')
  .action(async (action: string, key?: string, value?: string) => {
    const config = configManager.getAll();

    switch (action.toLowerCase()) {
      case 'list': {
        console.log('\n' + pc.bold('Current Configuration:') + '\n');
        console.log(`Config file: ${pc.dim(configManager.getConfigFilePath())}\n`);
        Object.entries(config).forEach(([k, v]) => {
          if (typeof v === 'object') {
            console.log(`${pc.cyan(k)}:`);
            Object.entries(v as Record<string, any>).forEach(([subK, subV]) => {
              console.log(`  ${pc.dim(subK)}: ${subV ? pc.green(String(subV)) : pc.red(String(subV))}`);
            });
          } else {
            console.log(`${pc.cyan(k)}: ${pc.bold(String(v))}`);
          }
        });
        console.log('\n');
        break;
      }

      case 'get': {
        if (!key) {
          logger.error('Please specify a configuration key. E.g.: apkdown config get downloadDir');
          return;
        }
        const val = configManager.get(key as keyof ApkDownConfig);
        console.log(`${pc.cyan(key)} = ${pc.bold(JSON.stringify(val))}`);
        break;
      }

      case 'set': {
        if (!key || value === undefined) {
          logger.error('Please specify key and value. E.g.: apkdown config set preferredArch arm64-v8a');
          return;
        }

        let parsedVal: any = value;
        if (value === 'true') parsedVal = true;
        else if (value === 'false') parsedVal = false;
        else if (!isNaN(Number(value))) parsedVal = Number(value);

        configManager.set(key as keyof ApkDownConfig, parsedVal);
        logger.success(`Set ${pc.cyan(key)} = ${pc.bold(String(value))}`);
        break;
      }

      case 'reset': {
        configManager.reset();
        logger.success('Configuration reset to default settings.');
        break;
      }

      default:
        logger.error(`Unknown action "${action}". Use get, set, list, or reset.`);
    }
  });
