/**
 * E2E Test Setup
 * 
 * Loads environment variables and sets up test environment
 */

import { config } from 'dotenv';
import { resolve } from 'node:path';

// Try to load .env.local from root or tally package
const envPaths = [
	resolve(__dirname, '../../.env.local'),
	resolve(__dirname, '../../../tally/.env.local'),
	resolve(__dirname, '../.env.local'),
];

for (const envPath of envPaths) {
	try {
		config({ path: envPath });
		if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
			break;
		}
	} catch {
		// Continue to next path
	}
}

// Check if API key is available
export const hasApiKey = !!process.env.GOOGLE_GENERATIVE_AI_API_KEY;

// Skip E2E tests if API key is not available or E2E_TRAJECTORIES is not set
export const shouldRunE2E = hasApiKey && (process.env.E2E_TRAJECTORIES === '1' || process.env.CI !== 'true');
