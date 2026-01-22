/**
 * Configuration types for Tally
 */

import type { RedisConfig, S2Config } from '../storage';

/**
 * Storage configuration
 */
export interface StorageConfigInput {
  /** Storage backend type */
  backend: 'local' | 's2' | 'redis';

  /** Path for local storage (defaults to '.tally') */
  path?: string;

  /** Auto-create folders on write */
  autoCreate?: boolean;

  /** S2 configuration (required if backend is 's2') */
  s2?: S2Config;

  /** Redis configuration (required if backend is 'redis') */
  redis?: RedisConfig;
}

/**
 * Default LLM settings
 */
export interface DefaultsConfig {
  /** Default model identifier */
  model?: string;

  /** Default temperature */
  temperature?: number;

  /** Default max retries */
  maxRetries?: number;
}

/**
 * Trajectory execution settings
 */
export interface TrajectoriesConfig {
  /** Maximum turns per trajectory */
  maxTurns?: number;

  /** Generate detailed logs */
  generateLogs?: boolean;

  /** Loop detection settings */
  loopDetection?: {
    /** Maximum consecutive times the same step can be selected */
    maxConsecutiveSameStep?: number;
  };
}

/**
 * Evaluation settings
 */
export interface EvaluationConfig {
  /** Maximum parallel evaluations */
  parallelism?: number;

  /** Evaluation timeout in milliseconds */
  timeout?: number;
}

/**
 * Tally configuration input (what users provide)
 */
export interface TallyConfigInput {
  /** Storage configuration */
  storage?: StorageConfigInput;

  /** Default LLM settings */
  defaults?: DefaultsConfig;

  /** Trajectory execution settings */
  trajectories?: TrajectoriesConfig;

  /** Evaluation settings */
  evaluation?: EvaluationConfig;
}

/**
 * Resolved Tally configuration (with defaults applied)
 */
export interface TallyConfig {
  /** Storage configuration (always present) */
  storage: Required<Pick<StorageConfigInput, 'backend'>> & Omit<StorageConfigInput, 'backend'>;

  /** Default LLM settings */
  defaults: DefaultsConfig;

  /** Trajectory execution settings */
  trajectories: TrajectoriesConfig;

  /** Evaluation settings */
  evaluation: EvaluationConfig;
}
