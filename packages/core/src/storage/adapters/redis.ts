/**
 * Redis Streams Storage Adapter
 *
 * Real-time storage using Redis Streams.
 * Best for: Real-time systems, distributed architectures, pub/sub patterns.
 */

import type { IStorage, StorageEntry } from '../storage.interface';

/**
 * Redis storage configuration
 */
export interface RedisConfig {
  /** Redis connection URL */
  url: string;

  /** Key prefix for all storage keys */
  keyPrefix?: string;

  /** Maximum entries per stream (for memory management) */
  streamMaxLen?: number;
}

/**
 * Redis Storage implementation
 *
 * Uses Redis Streams for storage. Each file path maps to a stream key,
 * and content is stored as stream entries.
 */
export class RedisStorage implements IStorage {
  private readonly client: RedisClient;
  private readonly keyPrefix: string;
  private readonly streamMaxLen: number | undefined;

  constructor(config: RedisConfig) {
    const Redis = requireRedis();
    this.client = new Redis(config.url);
    this.keyPrefix = config.keyPrefix ?? 'tally:';
    this.streamMaxLen = config.streamMaxLen;
  }

  private getKey(path: string): string {
    // Convert path separators to colons for Redis key naming
    const normalized = path.replace(/\//g, ':');
    return `${this.keyPrefix}${normalized}`;
  }

  private pathFromKey(key: string): string {
    // Convert back from Redis key to path
    const withoutPrefix = key.slice(this.keyPrefix.length);
    return withoutPrefix.replace(/:/g, '/');
  }

  async list(dirPath: string): Promise<StorageEntry[]> {
    const results: StorageEntry[] = [];

    try {
      const pattern = dirPath ? `${this.getKey(dirPath)}:*` : `${this.keyPrefix}*`;

      const keys = await this.client.keys(pattern);

      // Track directories we've seen
      const directories = new Set<string>();

      for (const key of keys) {
        const fullPath = this.pathFromKey(key);

        // Skip if this key doesn't start with our directory
        if (dirPath && !fullPath.startsWith(`${dirPath}/`)) {
          continue;
        }

        const relativePath = dirPath ? fullPath.slice(dirPath.length + 1) : fullPath;

        // Check if this is a direct child or nested
        const slashIndex = relativePath.indexOf('/');
        if (slashIndex === -1) {
          // Direct child file
          results.push({
            id: relativePath,
            path: fullPath,
            isDirectory: false,
          });
        } else {
          // Nested - add the directory
          const dirName = relativePath.slice(0, slashIndex);
          const dirFullPath = dirPath ? `${dirPath}/${dirName}` : dirName;
          if (!directories.has(dirFullPath)) {
            directories.add(dirFullPath);
            results.push({
              id: dirName,
              path: dirFullPath,
              isDirectory: true,
            });
          }
        }
      }
    } catch (err) {
      console.error(`Error listing children: ${(err as Error).message}`);
    }

    return results;
  }

  async stat(filePath: string): Promise<{ isDirectory: boolean } | null> {
    try {
      const key = this.getKey(filePath);
      const exists = await this.client.exists(key);

      if (exists) {
        return { isDirectory: false };
      }

      // Check if it's a directory (has children)
      const children = await this.list(filePath);
      if (children.length > 0) {
        return { isDirectory: true };
      }

      return null;
    } catch (err) {
      console.error(`Error getting stat: ${(err as Error).message}`);
      return null;
    }
  }

  async read(filePath: string): Promise<string> {
    try {
      const key = this.getKey(filePath);

      // Read all entries from the stream
      const entries = await this.client.xrange(key, '-', '+');

      if (!entries || entries.length === 0) {
        return '';
      }

      // Concatenate all content entries
      const contents: string[] = [];
      for (const [, fields] of entries) {
        // Fields is an array of [key, value, key, value, ...]
        for (let i = 0; i < fields.length; i += 2) {
          if (fields[i] === 'content') {
            contents.push(fields[i + 1] ?? '');
          }
        }
      }

      return contents.join('\n');
    } catch (err) {
      console.error(`Error reading file: ${(err as Error).message}`);
      return '';
    }
  }

  async write(filePath: string, content: string): Promise<void> {
    try {
      const key = this.getKey(filePath);

      // Delete existing stream and create new one
      await this.client.del(key);

      // Add content as a stream entry
      const args: (string | number)[] = [key];
      if (this.streamMaxLen) {
        args.push('MAXLEN', '~', this.streamMaxLen);
      }
      args.push('*', 'content', content);

      await this.client.xadd(...args);
    } catch (err) {
      console.error(`Error writing file: ${(err as Error).message}`);
      throw err;
    }
  }

  async append(filePath: string, content: string): Promise<void> {
    try {
      const key = this.getKey(filePath);

      const args: (string | number)[] = [key];
      if (this.streamMaxLen) {
        args.push('MAXLEN', '~', this.streamMaxLen);
      }
      args.push('*', 'content', content);

      await this.client.xadd(...args);
    } catch (err) {
      console.error(`Error appending to file: ${(err as Error).message}`);
      throw err;
    }
  }

  async delete(filePath: string): Promise<void> {
    try {
      const key = this.getKey(filePath);
      await this.client.del(key);
    } catch (err) {
      console.error(`Error deleting file: ${(err as Error).message}`);
      throw err;
    }
  }

  join(...segments: string[]): string {
    return segments.filter((s) => s).join('/');
  }

  /**
   * Close the Redis connection
   */
  async close(): Promise<void> {
    await this.client.quit();
  }
}

// Type definitions for dynamic import
interface RedisClient {
  keys(pattern: string): Promise<string[]>;
  exists(key: string): Promise<number>;
  xrange(key: string, start: string, end: string): Promise<[string, string[]][]>;
  xadd(...args: (string | number)[]): Promise<string>;
  del(key: string): Promise<number>;
  quit(): Promise<void>;
}

// Dynamic import helper for optional peer dependency
function requireRedis(): new (url: string) => RedisClient {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('ioredis');
  } catch {
    throw new Error('RedisStorage requires ioredis to be installed. Run: pnpm add ioredis');
  }
}
