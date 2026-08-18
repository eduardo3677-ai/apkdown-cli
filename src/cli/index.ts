import { Command } from 'commander';
import { searchCommand } from './commands/search.js';
import { downloadCommand } from './commands/download.js';
import { infoCommand, versionsCommand } from './commands/info.js';
import { providersCommand, configCommand } from './commands/providers.js';
import { runTUI } from '../tui/index.js';
import { logger } from './ui/logger.js';

export function createCli(): Command {
  const program = new Command();

  program
    .name('apkdown')
    .description('Professional Multi-Source APK & Split Downloader CLI & Interactive TUI')
    .version('1.0.0', '-v, --version', 'Output current version');

  // Register commands
  program.addCommand(searchCommand);
  program.addCommand(downloadCommand);
  program.addCommand(infoCommand);
  program.addCommand(versionsCommand);
  program.addCommand(providersCommand);
  program.addCommand(configCommand);

  // Register interactive TUI command
  program
    .command('tui')
    .alias('interactive')
    .alias('ui')
    .description('Launch the rich interactive Terminal User Interface (TUI)')
    .action(async () => {
      await runTUI();
    });

  return program;
}
