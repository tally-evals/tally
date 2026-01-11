import { defineConfig } from 'bunup';

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
  dts: {
    // Use inferTypes for complex Zod schema types
    inferTypes: true,
    // Prevent duplicated type declarations across multiple entrypoints (metrics/scorers/etc).
    // This keeps types like DatasetItem / SingleTurnContainer consistent between subpath exports.
    //
    // Ref: https://bunup.dev/docs/guide/typescript-declarations.html
    splitting: true,
  },
  sourcemap: true,
  clean: true,
  minify: false,
});
