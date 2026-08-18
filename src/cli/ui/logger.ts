import pc from 'picocolors';
import boxen from 'boxen';

export const logger = {
  info: (msg: string) => console.log(`${pc.cyan('ℹ')} ${msg}`),
  success: (msg: string) => console.log(`${pc.green('✔')} ${pc.bold(msg)}`),
  warn: (msg: string) => console.log(`${pc.yellow('⚠')} ${msg}`),
  error: (msg: string) => console.error(`${pc.red('✖')} ${pc.red(msg)}`),
  step: (step: string, msg: string) => console.log(`${pc.magenta(`[${step}]`)} ${msg}`),
  
  badge: (text: string, color: 'green' | 'yellow' | 'blue' | 'magenta' | 'cyan' = 'blue') => {
    const fn = pc[color] || pc.blue;
    return fn(`[${text}]`);
  },

  banner: () => {
    const text = `${pc.bold(pc.cyan('APKDOWN'))} ${pc.gray('v1.0.0')}
${pc.white('Multi-Source APK & Split Downloader')}
${pc.dim('Supports APKMirror, APKPure, APKCombo, Aptoide, F-Droid, GitHub & AppGallery')}`;

    console.log(
      boxen(text, {
        padding: 1,
        margin: { top: 0, bottom: 1 },
        borderStyle: 'round',
        borderColor: 'cyan',
      })
    );
  },
};
