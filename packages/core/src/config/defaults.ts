/**
 * Default configuration values
 */

import type { TallyConfig } from './types';

/**
 * Default configuration for Tally
 */
export const DEFAULT_CONFIG: TallyConfig = {
  storage: {
    backend: 'local',
    path: '.tally',
    autoCreate: true,
  },
  defaults: {
    temperature: 0,
    maxRetries: 3,
  },
  trajectories: {
    maxTurns: 10,
    generateLogs: false,
    loopDetection: {
      maxConsecutiveSameStep: 3,
    },
  },
  evaluation: {
    parallelism: 5,
    timeout: 30000,
  },
};
