#!/usr/bin/env node

import { createCli } from '../cli/index.js';
import { runTUI } from '../tui/index.js';
import { logger } from '../cli/ui/logger.js';
import { isCI, isGitHubAction, getActionInputs, setGitHubOutput, appendGitHubStepSummary } from '../utils/ci.js';
import { ApkDownloader } from '../core/downloader.js';
import { formatBytes } from '../utils/formatting.js';
import pc from 'picocolors';

async function runActionDirectly() {
  const inputs = getActionInputs();
  if (!inputs) return false;

  logger.info(`Detected GitHub Action Environment with inputs:`);
  console.log(`   - ID:                ${pc.bold(inputs.id)}`);
  console.log(`   - Provider:          ${inputs.provider}`);
  console.log(`   - Exclude Providers: ${inputs.excludeProviders.join(', ') || 'None'}`);
  console.log(`   - Architecture:      ${inputs.arch}`);
  console.log(`   - Version:           ${inputs.version}`);
  console.log(`   - Channel:           ${inputs.channel}`);
  console.log(`   - Output Directory:  ${inputs.outputDir}`);
  console.log('');

  let chosenProvider = inputs.provider;
  let chosenVersion = inputs.version;

  const result = await ApkDownloader.download(
    inputs.provider === 'all' ? undefined : inputs.provider,
    inputs.id,
    {
      version: inputs.version,
      preferredArch: inputs.arch as any,
      arch: inputs.arch as any,
      channel: inputs.channel as any,
      allowBeta: inputs.allowBeta,
      excludeProviders: inputs.excludeProviders,
      outputDir: inputs.outputDir,
      filename: inputs.filename,
      verifyChecksum: inputs.verifyChecksum,
      onComparison: (candidates: any[], chosen: any) => {
        chosenProvider = chosen.provider;
        chosenVersion = chosen.version;
        console.log('[CI] Cross-Provider Version Matrix:');
        for (const c of candidates) {
          const isWinner = c.provider === chosen.provider;
          console.log(`   [${c.provider}] ${c.appName} (${c.packageName}) -> v${c.version} [${c.bestVariant.packageType}] ${isWinner ? '★ WINNER' : ''}`);
        }
      },
    } as any
  );

  logger.success(`Downloaded APK successfully: ${pc.bold(result.filePath)}`);
  console.log(`   Size:    ${formatBytes(result.fileSizeBytes)}`);
  console.log(`   Format:  ${result.packageType}`);
  console.log(`   SHA256:  ${result.sha256 || 'N/A'}`);

  // Set GitHub Action outputs
  setGitHubOutput('file-path', result.filePath);
  setGitHubOutput('file-name', result.fileName);
  setGitHubOutput('file-size', result.fileSizeBytes);
  setGitHubOutput('file-size-formatted', formatBytes(result.fileSizeBytes));
  setGitHubOutput('version', chosenVersion);
  setGitHubOutput('package-type', result.packageType);
  setGitHubOutput('sha256', result.sha256 || '');
  setGitHubOutput('provider', chosenProvider);

  // Markdown Summary
  appendGitHubStepSummary(`
### 📱 APK Download Summary

| Property | Value |
|:---|:---|
| **App Identifier** | \`${inputs.id}\` |
| **Provider** | **${chosenProvider}** |
| **Version** | \`${chosenVersion}\` |
| **File Name** | \`${result.fileName}\` |
| **File Size** | \`${formatBytes(result.fileSizeBytes)}\` |
| **Package Format** | \`${result.packageType}\` |
| **Architecture** | \`${inputs.arch}\` |
| **SHA-256 Checksum** | \`${result.sha256 || 'N/A'}\` |
| **Integrity Verified** | ${result.checksumVerified ? '✅ Yes' : '⚠️ Skipped'} |
| **Local File Path** | \`${result.filePath}\` |
`);

  return true;
}

async function main() {
  // If invoked inside GitHub Actions with INPUT_ID set, run action mode automatically
  if (isGitHubAction() && process.env.INPUT_ID && process.argv.length <= 2) {
    await runActionDirectly();
    return;
  }

  const cli = createCli();

  // If no arguments provided
  if (process.argv.length <= 2) {
    if (isCI()) {
      cli.outputHelp();
      return;
    }
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
