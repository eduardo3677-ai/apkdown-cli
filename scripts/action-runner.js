#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run() {
  const rootDir = path.resolve(__dirname, '..');
  const distPath = path.join(rootDir, 'dist', 'index.js');

  if (!fs.existsSync(distPath)) {
    console.error('Build artifacts not found in dist/. Compiling bundle...');
    const { execSync } = await import('child_process');
    execSync('npm run build', { cwd: rootDir, stdio: 'inherit' });
  }

  const {
    ApkDownloader,
    providerRegistry,
    formatBytes,
  } = await import(distPath);

  const appId = process.env.INPUT_ID;
  if (!appId) {
    console.error('Error: "id" input is required (e.g. package name, app name, or repo).');
    process.exit(1);
  }

  const provider = process.env.INPUT_PROVIDER || 'all';
  const excludeProviderRaw = process.env.INPUT_EXCLUDE_PROVIDER || '';
  const excludeProviders = excludeProviderRaw
    .split(',')
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean);

  const archRaw = process.env.INPUT_ARCH || 'auto';
  const arch = archRaw === 'auto' ? 'arm64-v8a' : archRaw;

  const version = process.env.INPUT_VERSION || 'latest';
  const channel = process.env.INPUT_CHANNEL || 'stable';
  const allowBeta = process.env.INPUT_ALLOW_BETA === 'true' || channel !== 'stable';
  const outputDir = path.resolve(process.cwd(), process.env.INPUT_OUTPUT_DIR || './');
  const filename = process.env.INPUT_FILENAME || undefined;
  const verifyChecksum = process.env.INPUT_VERIFY_CHECKSUM !== 'false';

  console.log(`📦 Starting APKDown GitHub Action`);
  console.log(`   Target App:         ${appId}`);
  console.log(`   Provider:           ${provider}`);
  if (excludeProviders.length > 0) {
    console.log(`   Excluded Providers: ${excludeProviders.join(', ')}`);
  }
  console.log(`   Target Arch:        ${arch}`);
  console.log(`   Target Version:     ${version}`);
  console.log(`   Channel:            ${channel}`);
  console.log(`   Output Directory:   ${outputDir}`);
  console.log('');

  try {
    let chosenProviderName = provider;
    let chosenVersion = version;

    const result = await ApkDownloader.download(
      provider === 'all' ? undefined : provider,
      appId,
      {
        version,
        preferredArch: arch,
        arch,
        channel,
        allowBeta,
        excludeProviders,
        outputDir,
        filename,
        verifyChecksum,
        onComparison: (candidates, chosen) => {
          chosenProviderName = chosen.provider;
          chosenVersion = chosen.version;
          console.log('📊 Cross-Provider Version Matrix:');
          for (const cand of candidates) {
            const isWinner = cand.provider === chosen.provider;
            console.log(`   - [${cand.provider}] ${cand.appName} (${cand.packageName}) -> v${cand.version} [${cand.bestVariant.packageType}] ${isWinner ? '★ WINNER' : ''}`);
          }
          console.log('');
        },
        onProgress: (p) => {
          if (p.percentage % 25 === 0 || p.percentage === 100) {
            console.log(`   Progress: ${p.percentage}% | Downloaded: ${formatBytes(p.bytesDownloaded)} | Speed: ${formatBytes(p.speedBytesPerSec)}/s`);
          }
        },
      }
    );

    console.log('\n✅ Download Completed Successfully!');
    console.log(`   File:   ${result.filePath}`);
    console.log(`   Size:   ${formatBytes(result.fileSizeBytes)}`);
    console.log(`   Format: ${result.packageType}`);
    if (result.sha256) {
      console.log(`   SHA256: ${result.sha256} ${result.checksumVerified ? '(Verified)' : ''}`);
    }

    // Set GitHub Actions outputs
    if (process.env.GITHUB_OUTPUT) {
      const outputs = [
        `file_path=${result.filePath}`,
        `file_name=${result.fileName}`,
        `file_size=${result.fileSizeBytes}`,
        `file_size_formatted=${formatBytes(result.fileSizeBytes)}`,
        `version=${chosenVersion}`,
        `package_type=${result.packageType}`,
        `sha256=${result.sha256 || ''}`,
        `provider=${chosenProviderName}`,
      ];
      fs.appendFileSync(process.env.GITHUB_OUTPUT, outputs.join('\n') + '\n');
    }

    // Set GitHub Actions Job Step Summary
    if (process.env.GITHUB_STEP_SUMMARY) {
      const summaryMarkdown = `
### 📱 APK Download Summary

| Property | Value |
|:---|:---|
| **App Identifier** | \`${appId}\` |
| **Provider** | **${chosenProviderName}** |
| **Version** | \`${chosenVersion}\` |
| **File Name** | \`${result.fileName}\` |
| **File Size** | \`${formatBytes(result.fileSizeBytes)}\` |
| **Package Format** | \`${result.packageType}\` |
| **Architecture** | \`${arch}\` |
| **SHA-256 Checksum** | \`${result.sha256 || 'N/A'}\` |
| **Integrity Verified** | ${result.checksumVerified ? '✅ Yes' : '⚠️ Skipped'} |
| **Local File Path** | \`${result.filePath}\` |
`;
      fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summaryMarkdown);
    }
  } catch (err) {
    console.error(`\n❌ Action Failed: ${err.message}`);
    process.exit(1);
  }
}

run();
