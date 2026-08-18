#!/usr/bin/env node

import { createCli } from '../cli/index.js';
import { runTUI } from '../tui/index.js';
import { logger } from '../cli/ui/logger.js';

async function main() {
  const cli = createCli();

  // If no arguments provided, launch interactive TUI by default
  if (process.argv.length <= 2) {
    logger.banner();
    await runTUI();
    return;
  }

  try {
    await cli.parseAsync(process.argv);
  } catch (err: any) {
    logger.error(`Command execution failed: ${err.message}`);
    process.exit(1);
  }
}

main().catch((err) => {
  logger.error(`Fatal error: ${err.message}`);
  process.exit(1);
});
