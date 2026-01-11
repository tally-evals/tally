/**
 * S2.dev Streaming Storage Adapter
 *
 * Cloud-native streaming storage using S2.dev.
 * Best for: Serverless, cloud-native applications, real-time streaming.
 *
 * @see https://s2.dev/docs/concepts
 */

import type { IStorage, StorageEntry } from '../storage.interface';

/**
 * S2 storage configuration
 */
export interface S2Config {
  /** S2 basin name */
  basin: string;

  /** S2 access token */
  accessToken: string;
}

/**
 * S2 Storage implementation
 *
 * Uses S2.dev streams for storage. Each file path maps to a stream,
 * and each write appends a record to the stream.
 */
export class S2Storage implements IStorage {
  private readonly client: S2Client;
  private readonly basinName: string;

  constructor(config: S2Config) {
    // Dynamic import to handle optional peer dependency
    const { S2 } = requireS2();
    this.client = new S2({
      accessToken: config.accessToken,
    });
    this.basinName = config.basin;
  }

  async list(dirPath: string): Promise<StorageEntry[]> {
    const results: StorageEntry[] = [];

    try {
      const basin = this.client.basin(this.basinName);

      const prefix = dirPath === '' ? '' : dirPath;
      const listResult = await basin.streams.list({
        prefix,
      });

      for (const streamInfo of listResult.streams) {
        results.push({
          id: streamInfo.name,
          path: streamInfo.name,
          isDirectory: false,
        });
      }

      // Infer directories from stream paths
      const directories = new Set<string>();
      for (const entry of results) {
        const parts = entry.path.split('/');
        if (parts.length > 1) {
          let currentPath = '';
          for (let i = 0; i < parts.length - 1; i++) {
            currentPath = currentPath ? `${currentPath}/${parts[i]}` : (parts[i] ?? '');
            if (!prefix || currentPath.startsWith(prefix)) {
              directories.add(currentPath);
            }
          }
        }
      }

      for (const dir of Array.from(directories)) {
        if (!results.some((r) => r.path === dir)) {
          results.push({
            id: dir,
            path: dir,
            isDirectory: true,
          });
        }
      }
    } catch (err) {
      console.error(`Error listing children: ${(err as Error).message}`);
    }

    return results;
  }

  async stat(filePath: string): Promise<{ isDirectory: boolean } | null> {
    try {
      const basin = this.client.basin(this.basinName);

      try {
        await basin.streams.getConfig({
          stream: filePath,
        });
        return { isDirectory: false };
      } catch {
        const streams = await this.list(filePath);
        if (streams.length > 0) {
          return { isDirectory: true };
        }
        return null;
      }
    } catch (err) {
      console.error(`Error getting stat: ${(err as Error).message}`);
      return null;
    }
  }

  async read(filePath: string): Promise<string> {
    try {
      const basin = this.client.basin(this.basinName);
      const stream = basin.stream(filePath);
      const records: string[] = [];

      const readBatch = await stream.read(
        {
          start: {
            from: {
              seqNum: 0,
            },
            clamp: true,
          },
        },
        {
          as: 'bytes',
        }
      );

      for await (const record of readBatch.records) {
        let body: string;

        if (record.body instanceof Uint8Array) {
          const decoder = new TextDecoder();
          body = decoder.decode(record.body);
        } else if (typeof record.body === 'string') {
          body = record.body;
        } else {
          body = String(record.body);
        }

        records.push(body);
      }

      return records.join('\n');
    } catch (err) {
      console.error(`Error reading file: ${(err as Error).message}`);
      return '';
    }
  }

  async write(filePath: string, content: string): Promise<void> {
    try {
      const { AppendRecord } = requireS2();
      const basin = this.client.basin(this.basinName);
      const stream = basin.stream(filePath);

      const appendRecord = AppendRecord.string({
        body: content,
        headers: [['content-type', 'text/plain']],
      });

      await stream.append({
        records: [appendRecord],
        meteredBytes: appendRecord.meteredBytes,
      });
    } catch (err) {
      console.error(`Error writing file: ${(err as Error).message}`);
      throw err;
    }
  }

  async append(filePath: string, content: string): Promise<void> {
    // S2 is append-only by nature
    await this.write(filePath, content);
  }

  async delete(filePath: string): Promise<void> {
    try {
      const basin = this.client.basin(this.basinName);
      const stream = basin.stream(filePath);
      await stream.close();
    } catch (err) {
      console.error(`Error deleting file: ${(err as Error).message}`);
      throw err;
    }
  }

  join(...segments: string[]): string {
    return segments.filter((s) => s).join('/');
  }
}

// Type definitions for dynamic import
interface S2Client {
  basin(name: string): S2Basin;
}

interface S2Basin {
  streams: {
    list(options: { prefix: string }): Promise<{ streams: { name: string }[] }>;
    getConfig(options: { stream: string }): Promise<unknown>;
  };
  stream(name: string): S2Stream;
}

interface S2Stream {
  read(
    options: { start: { from: { seqNum: number }; clamp: boolean } },
    readOptions: { as: string }
  ): Promise<{
    records: AsyncIterable<{ body: Uint8Array | string }>;
  }>;
  append(options: {
    records: unknown[];
    meteredBytes: number;
  }): Promise<unknown>;
  close(): Promise<void>;
}

// Dynamic import helper for optional peer dependency
function requireS2(): {
  S2: new (options: { accessToken: string }) => S2Client;
  AppendRecord: {
    string(options: {
      body: string;
      headers: [string, string][];
    }): { meteredBytes: number };
  };
} {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('@s2-dev/streamstore');
  } catch {
    throw new Error(
      'S2Storage requires @s2-dev/streamstore to be installed. Run: pnpm add @s2-dev/streamstore'
    );
  }
}
