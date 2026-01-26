/**
 * Configuration module exports
 */

export type {
  TallyConfig,
  TallyConfigInput,
  StorageConfigInput,
  DefaultsConfig,
  TrajectoriesConfig,
  EvaluationConfig,
} from './types';

export { DEFAULT_CONFIG } from './defaults';

export { defineConfig, mergeConfig, isInTallyProject } from './helpers';

export { validateConfig } from './schema';

export {
  findConfigFile,
  loadConfigFile,
  CONFIG_FILE_NAMES,
} from './loader';

export {
  resolveConfig,
  getConfig,
  clearConfigCache,
  type ResolveConfigOptions,
} from './resolver';
