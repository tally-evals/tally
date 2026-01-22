import { stat, readdir, readFile, writeFile, unlink } from 'node:fs/promises';
import { IStorage, StorageEntry } from '../storage.interface';
import path from 'node:path';

export class LocalStorage implements IStorage {
  async list(dirPath: string): Promise<StorageEntry[]> {
    const results: StorageEntry[] = [];

    try {
      const entries = await readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        results.push({
          id: entry.name,
          path: path.join(dirPath, entry.name),
          isDirectory: entry.isDirectory(),
        });
      }
    } catch (err) {
      console.error(`Error listing children: ${(err as Error).message}`);
    }

    return results;
  }

  async stat(filePath: string): Promise<{ isDirectory: boolean } | null> {
    return stat(filePath).then((stat) => ({ isDirectory: stat.isDirectory() }));
  }

  async read(filePath: string): Promise<string> {
    return readFile(filePath, 'utf-8');
  }

  async write(filePath: string, content: string): Promise<void> {
    return writeFile(filePath, content, 'utf-8');
  }

  async delete(filePath: string): Promise<void> {
    return unlink(filePath);
  }

  join(...segments: string[]): string {
    return segments.join('/');
  }
}
