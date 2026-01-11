import { config } from 'dotenv';
import { defineConfig } from 'vitest/config';

// Load .env.local from package root (silent mode)
config({ path: '.env.local', quiet: true });

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 30000, // 30s for e2e tests with network calls
  },
});
