import { defineConfig } from 'bunup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: {
    // Use inferTypes for complex Zod schema types
    inferTypes: true,
  },
  sourcemap: true,
  clean: true,
});
