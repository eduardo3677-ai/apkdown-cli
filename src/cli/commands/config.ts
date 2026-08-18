import { Command } from 'commander';
import pc from 'picocolors';
import { configManager } from '../../core/config.js';
import { ApkDownConfig, Architecture, ReleaseChannel } from '../../core/types.js';
import { logger } from '../ui/logger.js';

export const configCommand = new Command('config')
  .alias('c')
  .description('View and update apkdown configuration options')
  .argument('[action]', 'Action to perform: get, set, list, reset, path', 'list')
  .argument('[key]', 'Configuration key to read or update')
  .argument('[value]', 'New value to assign')
  .option('--json', 'Output configuration in JSON format', false)
  .action(async (action: string, key?: string, value?: string, options?: any) => {
    const config = configManager.getAll();

    switch (action.toLowerCase()) {
      case 'list': {
        if (options?.json) {
          console.log(JSON.stringify(config, null, 2));
          return;
        }

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

      case 'path': {
        if (options?.json) {
          console.log(JSON.stringify({ path: configManager.getConfigFilePath(), dir: configManager.getConfigDir() }));
        } else {
          console.log(configManager.getConfigFilePath());
        }
        break;
      }

      case 'get': {
        if (!key) {
          logger.error('Please specify a configuration key. E.g.: apkdown config get downloadDir');
          return;
        }
        const val = configManager.get(key as keyof ApkDownConfig);
        if (options?.json) {
          console.log(JSON.stringify({ [key]: val }));
        } else {
          console.log(`${pc.cyan(key)} = ${pc.bold(JSON.stringify(val))}`);
        }
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
        logger.error(`Unknown action "${action}". Use get, set, list, path, or reset.`);
    }
  });
