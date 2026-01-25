/**
 * Storage factory for creating storage instances from configuration
 */

import { LocalStorage } from './adapters/local';
import { type RedisConfig, RedisStorage } from './adapters/redis';
import { type S2Config, S2Storage } from './adapters/s2';
import type { IStorage } from './storage.interface';

/**
 * Storage configuration for factory
 */
export interface StorageConfig {
  /** Storage backend type */
  backend: 'local' | 's2' | 'redis';

  /** Path for local storage (defaults to .tally) */
  path?: string;

  /** S2 configuration (required if backend is 's2') */
  s2?: S2Config;

  /** Redis configuration (required if backend is 'redis') */
  redis?: RedisConfig;
}

/**
 * Create a storage instance from configuration
 */
export function createStorage(config: StorageConfig): IStorage {
  switch (config.backend) {
    case 'local':
      return new LocalStorage();

    case 's2':
      if (!config.s2) {
        throw new Error(
          'S2 configuration is required when using s2 backend. Provide s2.basin and s2.accessToken.'
        );
      }
      return new S2Storage(config.s2);

    case 'redis':
      if (!config.redis) {
        throw new Error(
          'Redis configuration is required when using redis backend. Provide redis.url.'
        );
      }
      return new RedisStorage(config.redis);

    default:
      throw new Error(`Unknown storage backend: ${config.backend}`);
  }
}
