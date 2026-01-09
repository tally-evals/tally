import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    splitting: false,
    sourcemap: true,
  },
  {
    entry: ['src/bin.ts'],
    format: ['esm'],
    outDir: 'dist',
    dts: false,
    splitting: false,
    sourcemap: false,
    // Ensure bin.js is executable
    esbuildOptions(options) {
      options.banner = {
        js: '#!/usr/bin/env node',
      };
    },
  },
]);
