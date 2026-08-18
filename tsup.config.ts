import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['esm'],
    dts: false,
    clean: true,
    sourcemap: true,
  },
  {
    entry: ['src/bin/cli.ts'],
    format: ['esm'],
    outDir: 'dist/bin',
    sourcemap: true,
  },
]);
