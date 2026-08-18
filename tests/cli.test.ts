import { describe, it, expect } from 'vitest';
import { createCli } from '../src/cli/index.js';

describe('CLI Commands Registration & Help', () => {
  it('should create CLI program with all commands registered', () => {
    const cli = createCli();
    const commandNames = cli.commands.map((cmd) => cmd.name());

    expect(commandNames).toContain('search');
    expect(commandNames).toContain('download');
    expect(commandNames).toContain('info');
    expect(commandNames).toContain('versions');
    expect(commandNames).toContain('providers');
    expect(commandNames).toContain('config');
    expect(commandNames).toContain('doctor');
    expect(commandNames).toContain('tui');
  });

  it('should have proper command aliases registered', () => {
    const cli = createCli();
    const searchCmd = cli.commands.find((c) => c.name() === 'search');
    expect(searchCmd?.alias()).toBe('s');

    const downloadCmd = cli.commands.find((c) => c.name() === 'download');
    expect(downloadCmd?.alias()).toBe('d');

    const infoCmd = cli.commands.find((c) => c.name() === 'info');
    expect(infoCmd?.alias()).toBe('i');

    const doctorCmd = cli.commands.find((c) => c.name() === 'doctor');
    expect(doctorCmd?.alias()).toBe('doc');
  });

  it('should support --json flag on search, download, info, config, providers', () => {
    const cli = createCli();
    const cmds = ['search', 'download', 'info', 'versions', 'providers', 'config'];

    for (const name of cmds) {
      const cmd = cli.commands.find((c) => c.name() === name);
      const hasJsonOption = cmd?.options.some((opt) => opt.long === '--json');
      expect(hasJsonOption, `Command ${name} must have --json option`).toBe(true);
    }
  });

  it('should support --dry-run option on download', () => {
    const cli = createCli();
    const downloadCmd = cli.commands.find((c) => c.name() === 'download');
    const hasDryRun = downloadCmd?.options.some((opt) => opt.long === '--dry-run');
    expect(hasDryRun).toBe(true);
  });
});
