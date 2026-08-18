import * as p from '@clack/prompts';
import pc from 'picocolors';
import { runSearchScreen } from './search-screen.js';
import { runDetailScreen } from './detail-screen.js';
import { runDownloadScreen } from './download-screen.js';
import { runConfigScreen } from './config-screen.js';
import { providerRegistry } from '../providers/registry.js';
import { renderProvidersTable } from '../cli/ui/table.js';
import { configManager } from '../core/config.js';

export async function runTUI(): Promise<void> {
  console.clear();
  p.intro(
    `${pc.bgCyan(pc.black(' APKDOWN '))} ${pc.bold('Interactive Terminal UI')} ${pc.dim('v1.0.0')}`
  );

  let running = true;

  while (running) {
    const action = await p.select({
      message: 'What would you like to do?',
      options: [
        { value: 'search', label: '🔍 Search & Download APKs', hint: 'multi-source search' },
        { value: 'providers', label: '🌐 View Available APK Providers', hint: 'check active sources' },
        { value: 'settings', label: '⚙️ Settings & Configuration', hint: 'arch, paths, channels' },
        { value: 'exit', label: '🚪 Exit' },
      ],
    });

    if (p.isCancel(action) || action === 'exit') {
      p.outro(pc.cyan('Thank you for using apkdown-cli!'));
      process.exit(0);
    }

    switch (action) {
      case 'search': {
        const appRef = await runSearchScreen();
        if (appRef) {
          const detailResult = await runDetailScreen(appRef);
          if (detailResult) {
            await runDownloadScreen(detailResult.details, detailResult.variant);
          }
        }
        break;
      }

      case 'providers': {
        const config = configManager.getAll();
        const providers = providerRegistry.getAll();
        console.log('\n' + renderProvidersTable(providers, config.providers) + '\n');
        await p.text({ message: 'Press Enter to continue...' });
        break;
      }

      case 'settings': {
        await runConfigScreen();
        break;
      }
    }
  }
}
