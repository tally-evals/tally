import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  outDir: 'dist',
});

/*
cjs = commonjs (older Node.js module system, and it typically uses require() to
 import modules)
esm = ES module (newer Node.js module system, and it typically uses import to
 import modules)
*/