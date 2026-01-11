import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  test: {
    testTimeout: 300 * 1000, // 5min
    watch: false,
  },
  plugins: [tsconfigPaths()],
})