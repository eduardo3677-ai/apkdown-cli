import cliProgress from 'cli-progress';
import pc from 'picocolors';
import { isCI } from '../../utils/ci.js';

export interface ProgressBarWrapper {
  start: (total: number, startValue: number, payload?: any) => void;
  update: (current: number, payload?: any) => void;
  stop: () => void;
}

export function createDownloadProgressBar(fileName: string): ProgressBarWrapper {
  if (isCI()) {
    let lastLoggedPct = -1;
    return {
      start: (total: number, startValue: number, payload?: any) => {
        console.log(`[CI] Starting download for "${fileName}"...`);
      },
      update: (current: number, payload?: any) => {
        const pct = Math.floor(current);
        if (pct % 25 === 0 && pct !== lastLoggedPct) {
          lastLoggedPct = pct;
          const downloaded = payload?.downloaded || '';
          const total = payload?.total || '';
          const speed = payload?.speed || '';
          console.log(`[CI] Progress: ${pct}% | ${downloaded}/${total} | Speed: ${speed}`);
        }
      },
      stop: () => {
        console.log(`[CI] Download completed.`);
      },
    };
  }

  return new cliProgress.SingleBar(
    {
      format: `${pc.cyan('{bar}')} ${pc.bold('{percentage}%')} | ${pc.green('{downloaded}')}/{total} | ${pc.yellow('{speed}')} | ETA: ${pc.magenta('{eta}')}`,
      barCompleteChar: '█',
      barIncompleteChar: '░',
      hideCursor: true,
      clearOnComplete: false,
    },
    cliProgress.Presets.shades_classic
  );
}
