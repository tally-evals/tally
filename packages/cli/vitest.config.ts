import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 120000, // 2 minutes for E2E tests
    include: ['**/*.test.ts', '**/*.e2e.test.ts'],
    exclude: ['node_modules', 'dist'],
  },
});
