import fs from 'fs';
import path from 'path';

export interface ActionInputs {
  id: string;
  provider: string;
  excludeProviders: string[];
  arch: string;
  version: string;
  channel: string;
  allowBeta: boolean;
  outputDir: string;
  filename?: string;
  verifyChecksum: boolean;
}

export function isCI(): boolean {
  return Boolean(
    process.env.CI ||
    process.env.GITHUB_ACTIONS ||
    process.env.GITLAB_CI ||
    process.env.TRAVIS ||
    process.env.CIRCLECI ||
    !process.stdout.isTTY
  );
}

export function isGitHubAction(): boolean {
  return Boolean(process.env.GITHUB_ACTIONS || process.env.INPUT_ID);
}

export function getActionInputs(): ActionInputs | null {
  const id = process.env.INPUT_ID;
  if (!id) return null;

  const provider = process.env.INPUT_PROVIDER || 'all';
  const excludeRaw = process.env.INPUT_EXCLUDE_PROVIDER || '';
  const excludeProviders = excludeRaw
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

  return {
    id,
    provider,
    excludeProviders,
    arch,
    version,
    channel,
    allowBeta,
    outputDir,
    filename,
    verifyChecksum,
  };
}

export function setGitHubOutput(key: string, value: string | number | boolean): void {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (outputPath && fs.existsSync(path.dirname(outputPath))) {
    try {
      fs.appendFileSync(outputPath, `${key}=${value}\n`, 'utf-8');
    } catch {
      // Ignore if file not accessible
    }
  }
}

export function appendGitHubStepSummary(markdown: string): void {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (summaryPath && fs.existsSync(path.dirname(summaryPath))) {
    try {
      fs.appendFileSync(summaryPath, markdown + '\n', 'utf-8');
    } catch {
      // Ignore if file not accessible
    }
  }
}
