import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		globals: true,
		environment: 'node',
		watch: false, // Disable watch mode by default
		testTimeout: 120000, // 2 minutes for trajectory tests
		include: ['**/*.spec.ts', '**/*.test.ts'],
		exclude: ['node_modules', 'dist'],
	},
});

