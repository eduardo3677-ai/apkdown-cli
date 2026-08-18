import { Command } from 'commander';
import pc from 'picocolors';
import fs from 'fs';
import os from 'os';
import { execSync } from 'child_process';
import { defaultHttpClient } from '../../http/hybrid-client.js';
import { configManager } from '../../core/config.js';
import { logger } from '../ui/logger.js';

interface CheckItem {
  name: string;
  status: 'ok' | 'warn' | 'error';
  message: string;
  details?: string;
}

export const doctorCommand = new Command('doctor')
  .alias('doc')
  .description('Diagnose system environment, Python TLS impersonator, network connectivity, and permissions')
  .action(async () => {
    logger.info('Running apkdown environment diagnostics...\n');

    const checks: CheckItem[] = [];

    // 1. Node.js Check
    const nodeVer = process.version;
    const nodeMajor = parseInt(nodeVer.replace('v', '').split('.')[0], 10);
    if (nodeMajor >= 18) {
      checks.push({
        name: 'Node.js Runtime',
        status: 'ok',
        message: `${nodeVer} (Supported >= 18.0.0)`,
      });
    } else {
      checks.push({
        name: 'Node.js Runtime',
        status: 'error',
        message: `${nodeVer} is outdated. Please upgrade to Node 18 or higher.`,
      });
    }

    // 2. Python 3 & curl_cffi Check
    try {
      const pythonVer = execSync('python3 --version', { stdio: 'pipe' }).toString().trim();
      try {
        execSync('python3 -c "import curl_cffi; print(curl_cffi.__version__)"', { stdio: 'pipe' });
        checks.push({
          name: 'Python TLS Engine (curl_cffi)',
          status: 'ok',
          message: `${pythonVer} with curl_cffi installed (Cloudflare bypass active)`,
        });
      } catch {
        checks.push({
          name: 'Python TLS Engine (curl_cffi)',
          status: 'warn',
          message: 'Python 3 found, but curl_cffi is not installed.',
          details: 'Run: pip install curl_cffi (recommended to bypass Cloudflare bot checks)',
        });
      }
    } catch {
      checks.push({
        name: 'Python Runtime',
        status: 'warn',
        message: 'python3 command not found in PATH.',
        details: 'Native fetch will be used (some Cloudflare-protected providers might block requests)',
      });
    }

    // 3. Download Directory Permissions Check
    const config = configManager.getAll();
    const targetDir = config.downloadDir;
    try {
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
      const testFile = `${targetDir}/.apkdown_perm_test_${Date.now()}`;
      fs.writeFileSync(testFile, 'test', 'utf-8');
      fs.unlinkSync(testFile);
      checks.push({
        name: 'Download Directory Write Access',
        status: 'ok',
        message: `${targetDir} (Writable)`,
      });
    } catch (err: any) {
      checks.push({
        name: 'Download Directory Write Access',
        status: 'error',
        message: `Cannot write to ${targetDir}: ${err.message}`,
      });
    }

    // 4. Network Connectivity Check
    const testEndpoints = [
      { name: 'APKPure', url: 'https://apkpure.com' },
      { name: 'F-Droid', url: 'https://f-droid.org' },
      { name: 'Aptoide API', url: 'http://ws75.aptoide.com/api/7/apps/search?query=test&limit=1' },
      { name: 'Huawei AppGallery', url: 'https://appgallery.huawei.com' },
    ];

    for (const ep of testEndpoints) {
      try {
        const start = Date.now();
        await defaultHttpClient.get(ep.url, { timeoutMs: 5000 });
        const latency = Date.now() - start;
        checks.push({
          name: `Network: ${ep.name}`,
          status: 'ok',
          message: `Online (${latency}ms latency)`,
        });
      } catch (err: any) {
        checks.push({
          name: `Network: ${ep.name}`,
          status: 'warn',
          message: `Unreachable or slow: ${err.message}`,
        });
      }
    }

    // Print Diagnostics Table
    console.log(pc.bold('System & Environment Status:'));
    for (const c of checks) {
      let icon = pc.green('✔');
      if (c.status === 'warn') icon = pc.yellow('⚠');
      if (c.status === 'error') icon = pc.red('✖');

      console.log(`  ${icon} ${pc.bold(c.name)}: ${c.message}`);
      if (c.details) {
        console.log(`     ${pc.dim(c.details)}`);
      }
    }
    console.log('');

    const hasError = checks.some((c) => c.status === 'error');
    if (hasError) {
      logger.error('Diagnostics found issues that may prevent apkdown from working properly.');
    } else {
      logger.success('All essential checks passed! apkdown is ready to download APKs.');
    }
  });
