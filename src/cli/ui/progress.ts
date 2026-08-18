import cliProgress from 'cli-progress';
import pc from 'picocolors';

export function createDownloadProgressBar(fileName: string): cliProgress.SingleBar {
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
