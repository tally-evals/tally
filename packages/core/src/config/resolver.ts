/**
 * Configuration resolver
 *
 * Resolves configuration by loading config file and applying defaults.
 */

import { mergeConfig } from './helpers';
import { findConfigFile, loadConfigFile } from './loader';
import { validateConfig } from './schema';
import type { TallyConfig, TallyConfigInput } from './types';

/**
 * Options for resolving configuration
 */
export interface ResolveConfigOptions {
  /** Starting directory for config file search (defaults to cwd) */
  cwd?: string;

  /** Override configuration values */
  overrides?: Partial<TallyConfigInput>;

  /** Skip config file loading (use only defaults + overrides) */
  skipConfigFile?: boolean;
}

// Cached configuration
let cachedConfig: TallyConfig | null = null;

/**
 * Resolve configuration by loading config file and applying defaults
 *
 * @example
 * ```typescript
 * // Load from config file
 * const config = await resolveConfig();
 *
 * // With overrides
 * const config = await resolveConfig({
 *   overrides: { storage: { backend: 'local' } }
 * });
 * ```
 */
export async function resolveConfig(options: ResolveConfigOptions = {}): Promise<TallyConfig> {
  const { cwd = process.cwd(), overrides, skipConfigFile = false } = options;

  let userConfig: TallyConfigInput = {};

  // Load from config file if not skipped
  if (!skipConfigFile) {
    const configPath = findConfigFile(cwd);
    if (configPath) {
      try {
        userConfig = await loadConfigFile(configPath);
      } catch (err) {
        console.warn(`Warning: Failed to load config file: ${(err as Error).message}`);
      }
    }
  }

  // Apply environment variables
  const envConfig = loadEnvConfig();

  // Build merged config input
  const mergedInput: TallyConfigInput = {};

  // Merge storage config
  const storageConfigs = [userConfig.storage, envConfig.storage, overrides?.storage].filter(
    Boolean
  );
  if (storageConfigs.length > 0) {
    mergedInput.storage = Object.assign({}, ...storageConfigs);
  }

  // Merge defaults config
  const defaultsConfigs = [userConfig.defaults, envConfig.defaults, overrides?.defaults].filter(
    Boolean
  );
  if (defaultsConfigs.length > 0) {
    mergedInput.defaults = Object.assign({}, ...defaultsConfigs);
  }

  // Merge trajectories config
  const trajectoriesConfigs = [
    userConfig.trajectories,
    envConfig.trajectories,
    overrides?.trajectories,
  ].filter(Boolean);
  if (trajectoriesConfigs.length > 0) {
    mergedInput.trajectories = Object.assign({}, ...trajectoriesConfigs);
  }

  // Merge evaluation config
  const evaluationConfigs = [
    userConfig.evaluation,
    envConfig.evaluation,
    overrides?.evaluation,
  ].filter(Boolean);
  if (evaluationConfigs.length > 0) {
    mergedInput.evaluation = Object.assign({}, ...evaluationConfigs);
  }

  // Merge with defaults
  const merged = mergeConfig(mergedInput);

  // Validate final config
  const result = validateConfig(merged);
  if (!result.success) {
    throw new Error(`Invalid configuration: ${result.error?.message ?? 'Unknown error'}`);
  }

  // Cache the resolved config
  cachedConfig = merged;

  return merged;
}

/**
 * Get cached configuration (or resolve if not cached)
 */
export async function getConfig(): Promise<TallyConfig> {
  if (cachedConfig) {
    return cachedConfig;
  }
  return resolveConfig();
}

/**
 * Clear cached configuration
 */
export function clearConfigCache(): void {
  cachedConfig = null;
}

/**
 * Load configuration from environment variables
 */
function loadEnvConfig(): TallyConfigInput {
  const config: TallyConfigInput = {};

  // Storage
  const storageBackend = process.env.TALLY_STORAGE_BACKEND as 'local' | 's2' | 'redis' | undefined;
  const storagePath = process.env.TALLY_STORAGE_PATH;
  const s2Basin = process.env.TALLY_S2_BASIN;
  const s2AccessToken = process.env.TALLY_S2_ACCESS_TOKEN;
  const redisUrl = process.env.TALLY_REDIS_URL;
  const redisKeyPrefix = process.env.TALLY_REDIS_KEY_PREFIX;

  if (storageBackend || storagePath || s2Basin || redisUrl) {
    config.storage = {
      backend: storageBackend ?? 'local',
    };

    if (storagePath) {
      config.storage.path = storagePath;
    }

    if (s2Basin && s2AccessToken) {
      config.storage.s2 = {
        basin: s2Basin,
        accessToken: s2AccessToken,
      };
    }

    if (redisUrl) {
      const redisConfig: { url: string; keyPrefix?: string } = {
        url: redisUrl,
      };
      if (redisKeyPrefix) {
        redisConfig.keyPrefix = redisKeyPrefix;
      }
      config.storage.redis = redisConfig;
    }
  }

  // Defaults
  const defaultModel = process.env.TALLY_DEFAULT_MODEL;
  const defaultTemperature = process.env.TALLY_DEFAULT_TEMPERATURE;

  if (defaultModel || defaultTemperature) {
    config.defaults = {};
    if (defaultModel) {
      config.defaults.model = defaultModel;
    }
    if (defaultTemperature) {
      config.defaults.temperature = Number.parseFloat(defaultTemperature);
    }
  }

  return config;
}
