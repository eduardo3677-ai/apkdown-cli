import { Command } from 'commander';
import { searchCommand } from './commands/search.js';
import { downloadCommand } from './commands/download.js';
import { infoCommand, versionsCommand } from './commands/info.js';
import { providersCommand } from './commands/providers.js';
import { configCommand } from './commands/config.js';
import { doctorCommand } from './commands/doctor.js';
import { runTUI } from '../tui/index.js';

export function createCli(): Command {
  const program = new Command();

  program
    .name('apkdown')
    .description('Professional Multi-Source APK & Split Downloader CLI & Interactive TUI')
    .version('1.0.3', '-v, --version', 'Output current version');

  // Register all CLI commands
  program.addCommand(searchCommand);
  program.addCommand(downloadCommand);
  program.addCommand(infoCommand);
  program.addCommand(versionsCommand);
  program.addCommand(providersCommand);
  program.addCommand(configCommand);
  program.addCommand(doctorCommand);

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
