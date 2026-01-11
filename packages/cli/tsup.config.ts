import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    splitting: false,
    sourcemap: true,
    esbuildOptions(options) {
      options.jsx = 'automatic';
      options.jsxImportSource = 'react';
    },
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
      options.jsx = 'automatic';
      options.jsxImportSource = 'react';
      options.banner = {
        js: '#!/usr/bin/env node',
      };
    },
  },
]);
