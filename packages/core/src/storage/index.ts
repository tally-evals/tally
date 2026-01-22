/**
 * Storage module exports
 */

export type { IStorage, StorageEntry } from './storage.interface';
export { LocalStorage, S2Storage, RedisStorage } from './adapters';
export type { S2Config, RedisConfig } from './adapters';
export { createStorage, type StorageConfig } from './factory';
