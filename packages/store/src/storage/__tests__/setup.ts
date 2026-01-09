import { config } from 'dotenv';
import { resolve } from 'node:path';

const envPaths = [
  resolve(__dirname, '../../../.env.local'),
  resolve(__dirname, '../../.env.local'),
  resolve(__dirname, '../.env.local'),
];

for (const envPath of envPaths) {
  try {
    config({ path: envPath });
    if (process.env.S2_ACCESS_KEY) {
      break;
    }
  } catch {
    // Continue to next path
  }
}

export const hasS2AccessKey = !!process.env.S2_ACCESS_KEY;
