import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/metrics/index.ts',
    'src/scorers/index.ts',
    'src/aggregators/index.ts',
    'src/normalization/index.ts',
    'src/data/index.ts',
  ],
  format: ['cjs', 'esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  minify: false,
  external: [],
});
