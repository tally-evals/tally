import { AppendRecord, S2 } from '@s2-dev/streamstore';
import { IStorage, StorageEntry } from '../storage.interface';

interface S2Config {
  basin: string;
  accessToken: string;
}

export class S2Storage implements IStorage {
  private readonly client: S2;
  private readonly basinName: string;

  constructor(config: S2Config) {
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

      const directories = new Set<string>();
      for (const entry of results) {
        const parts = entry.path.split('/');
        if (parts.length > 1) {
          let currentPath = '';
          for (let i = 0; i < parts.length - 1; i++) {
            currentPath = currentPath
              ? `${currentPath}/${parts[i]}`
              : parts[i] ?? '';
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
      } catch (err) {
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
        },
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
      return Promise.resolve();
    } catch (err) {
      console.error(`Error writing file: ${(err as Error).message}`);
      return Promise.reject(err);
    }
  }

  async delete(filePath: string): Promise<void> {
    try {
      const basin = this.client.basin(this.basinName);
      const stream = basin.stream(filePath);
      await stream.close();
    } catch (err) {
      console.error(`Error deleting file: ${(err as Error).message}`);
      return Promise.reject(err);
    }
  }

  join(...segments: string[]): string {
    return segments.filter((s) => s).join('/');
  }
}
