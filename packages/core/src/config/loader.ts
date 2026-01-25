/**
 * Configuration file loader
 *
 * Loads tally.config.ts or tally.config.js files using dynamic import.
 */

import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { TallyConfigInput } from './types';

/**
 * Supported config file names in priority order
 */
export const CONFIG_FILE_NAMES = [
  'tally.config.ts',
  'tally.config.js',
  'tally.config.mjs',
  'tally.config.cjs',
] as const;

/**
 * Find config file by walking up from a starting path
 */
export function findConfigFile(startPath: string = process.cwd()): string | null {
  let currentPath = resolve(startPath);

  while (true) {
    for (const fileName of CONFIG_FILE_NAMES) {
      const configPath = resolve(currentPath, fileName);
      if (existsSync(configPath)) {
        return configPath;
      }
    }

    const parentPath = dirname(currentPath);
    if (parentPath === currentPath) {
      // Reached root
      break;
    }
    currentPath = parentPath;
  }

  return null;
}

/**
 * Load a configuration file
 *
 * Note: For TypeScript files, this requires either:
 * - Node.js 22+ with native TypeScript support
 * - Running via tsx, ts-node, or similar
 * - Pre-compiled to JavaScript
 */
export async function loadConfigFile(configPath: string): Promise<TallyConfigInput> {
  try {
    // Use dynamic import for both ESM and CJS
    const module = await import(configPath);

    // Support both default export and named export
    const config = module.default ?? module.config ?? module;

    if (typeof config !== 'object' || config === null) {
      throw new Error(`Config file must export an object. Got: ${typeof config}`);
    }

    return config as TallyConfigInput;
  } catch (err) {
    const error = err as Error;

    // Provide helpful error for TypeScript files
    if (configPath.endsWith('.ts') && error.message.includes('Cannot find module')) {
      throw new Error(
        `Cannot load TypeScript config file. Ensure you're running with tsx, ts-node, or Node.js 22+ with TypeScript support. Original error: ${error.message}`
      );
    }

    throw new Error(`Failed to load config file '${configPath}': ${error.message}`);
  }
}
