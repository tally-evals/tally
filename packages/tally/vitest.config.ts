import { defineConfig } from 'vitest/config';
import path from 'path';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env.local file
config({ path: resolve(__dirname, '.env.local') });

export default defineConfig({
	resolve: {
		alias: {
			'@tally/core': path.resolve(__dirname, './src/core'),
			'@tally/utils': path.resolve(__dirname, './src/utils'),
		},
	},
	test: {
		globals: true,
		environment: 'node',
		watch: false, // Disable watch mode by default
		coverage: {
			provider: 'v8',
			reporter: ['text', 'json', 'html'],
			exclude: ['node_modules/', 'dist/', '**/*.d.ts', '**/*.config.*', '**/coverage/**'],
		},
	},
});
