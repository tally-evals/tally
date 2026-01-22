/**
 * Configuration helper functions
 */

import { DEFAULT_CONFIG } from './defaults';
import { validateConfig } from './schema';
import type { TallyConfig, TallyConfigInput } from './types';

/**
 * Define a Tally configuration with type safety
 *
 * @example
 * ```typescript
 * // tally.config.ts
 * import { defineConfig } from '@tally-evals/core';
 *
 * export default defineConfig({
 *   storage: {
 *     backend: 'local',
 *     path: '.tally',
 *   },
 * });
 * ```
 */
export function defineConfig(config: TallyConfigInput): TallyConfigInput {
  // Validate at definition time for early error detection
  const result = validateConfig(config);
  if (!result.success) {
    throw new Error(`Invalid configuration: ${result.error?.message ?? 'Unknown error'}`);
  }
  return config;
}

/**
 * Merge user config with defaults
 */
export function mergeConfig(userConfig: TallyConfigInput | undefined): TallyConfig {
  if (!userConfig) {
    return DEFAULT_CONFIG;
  }

  return {
    storage: {
      ...DEFAULT_CONFIG.storage,
      ...userConfig.storage,
    },
    defaults: {
      ...DEFAULT_CONFIG.defaults,
      ...userConfig.defaults,
    },
    trajectories: {
      ...DEFAULT_CONFIG.trajectories,
      ...userConfig.trajectories,
      loopDetection: {
        ...DEFAULT_CONFIG.trajectories.loopDetection,
        ...userConfig.trajectories?.loopDetection,
      },
    },
    evaluation: {
      ...DEFAULT_CONFIG.evaluation,
      ...userConfig.evaluation,
    },
  };
}

/**
 * Check if a path contains a tally project
 * (has .tally directory or tally.config.ts)
 */
export function isInTallyProject(_path: string): boolean {
  // This is a placeholder - actual implementation would check filesystem
  // For now, always return false and let the resolver handle it
  return false;
}
