import * as p from '@clack/prompts';
import pc from 'picocolors';
import { configManager } from '../core/config.js';
import { Architecture, ReleaseChannel } from '../core/types.js';
import { SUPPORTED_ARCHITECTURES, RELEASE_CHANNELS } from '../core/constants.js';

export async function runConfigScreen(): Promise<void> {
  const config = configManager.getAll();

  const choice = await p.select({
    message: 'Configuration Settings:',
    options: [
      { value: 'downloadDir', label: 'Download Directory', hint: config.downloadDir },
      { value: 'preferredArch', label: 'Preferred Architecture', hint: config.preferredArch },
      { value: 'includeBeta', label: 'Include Beta / Previews', hint: config.includeBeta ? 'Enabled' : 'Disabled' },
      { value: 'defaultChannel', label: 'Default Release Channel', hint: config.defaultChannel },
      { value: 'defaultProvider', label: 'Default Search Provider', hint: config.defaultProvider },
      { value: 'verifyChecksums', label: 'Verify Cryptographic Hashes', hint: config.verifyChecksums ? 'Yes' : 'No' },
      { value: 'reset', label: 'Reset to Default Settings', hint: 'restore initial config' },
      { value: 'back', label: '← Back to Main Menu' },
    ],
  });

  if (p.isCancel(choice) || choice === 'back') return;

  switch (choice) {
    case 'downloadDir': {
      const dir = await p.text({
        message: 'Enter default download directory:',
        initialValue: config.downloadDir,
      });
      if (!p.isCancel(dir)) {
        configManager.set('downloadDir', dir);
        p.note(`Download directory updated to: ${dir}`);
      }
      break;
    }

    case 'preferredArch': {
      const arch = await p.select({
        message: 'Select preferred architecture for your device:',
        options: SUPPORTED_ARCHITECTURES.map((a) => ({
          value: a,
          label: a,
          hint: a === 'arm64-v8a' ? 'Most modern 64-bit phones' : a === 'armeabi-v7a' ? 'Older 32-bit devices' : '',
        })),
        initialValue: config.preferredArch,
      });
      if (!p.isCancel(arch)) {
        configManager.set('preferredArch', arch as Architecture);
        p.note(`Preferred architecture set to: ${arch}`);
      }
      break;
    }

    case 'includeBeta': {
      const includeBeta = await p.confirm({
        message: 'Include Beta, Preview, and Insider builds in searches by default?',
        initialValue: config.includeBeta,
      });
      if (!p.isCancel(includeBeta)) {
        configManager.set('includeBeta', includeBeta);
        p.note(`Include beta set to: ${includeBeta}`);
      }
      break;
    }

    case 'defaultChannel': {
      const channel = await p.select({
        message: 'Select default release channel:',
        options: RELEASE_CHANNELS.map((c) => ({ value: c, label: c })),
        initialValue: config.defaultChannel,
      });
      if (!p.isCancel(channel)) {
        configManager.set('defaultChannel', channel as ReleaseChannel);
        p.note(`Default channel set to: ${channel}`);
      }
      break;
    }

    case 'defaultProvider': {
      const prov = await p.select({
        message: 'Select default provider:',
        options: [
          { value: 'all', label: 'All Providers (Aggregated)' },
          { value: 'aptoide', label: 'Aptoide' },
          { value: 'apkmirror', label: 'APKMirror' },
          { value: 'apkpure', label: 'APKPure' },
          { value: 'apkcombo', label: 'APKCombo' },
          { value: 'fdroid', label: 'F-Droid' },
          { value: 'github', label: 'GitHub Releases' },
          { value: 'appgallery', label: 'Huawei AppGallery' },
        ],
        initialValue: config.defaultProvider,
      });
      if (!p.isCancel(prov)) {
        configManager.set('defaultProvider', prov as string);
        p.note(`Default provider set to: ${prov}`);
      }
      break;
    }

    case 'verifyChecksums': {
      const verify = await p.confirm({
        message: 'Automatically verify MD5 / SHA256 hashes when available?',
        initialValue: config.verifyChecksums,
      });
      if (!p.isCancel(verify)) {
        configManager.set('verifyChecksums', verify);
        p.note(`Checksum verification set to: ${verify}`);
      }
      break;
    }

    case 'reset': {
      const confirmReset = await p.confirm({
        message: 'Are you sure you want to reset all configurations to defaults?',
        initialValue: false,
      });
      if (confirmReset) {
        configManager.reset();
        p.note('All settings restored to defaults.');
      }
      break;
    }
  }
}
