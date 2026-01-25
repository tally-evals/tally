import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/metrics/index.ts',
    'src/scorers/index.ts',
    'src/aggregators/index.ts',
    'src/normalization/index.ts',
  ],
  format: ['cjs', 'esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  outDir: 'dist',
});
