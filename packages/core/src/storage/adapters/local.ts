/**
 * Local Filesystem Storage Adapter
 *
 * Default storage implementation using Node.js fs module.
 * Best for: Development, CI pipelines, single-machine deployments.
 */

import { mkdir, readFile, readdir, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { IStorage, StorageEntry } from '../storage.interface';

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
      // Directory doesn't exist or can't be read
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.error(`Error listing children: ${(err as Error).message}`);
      }
    }

    return results;
  }

  async stat(filePath: string): Promise<{ isDirectory: boolean } | null> {
    try {
      const stats = await stat(filePath);
      return { isDirectory: stats.isDirectory() };
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw err;
    }
  }

  async read(filePath: string): Promise<string> {
    return readFile(filePath, 'utf-8');
  }

  async write(filePath: string, content: string): Promise<void> {
    // Ensure parent directory exists
    const dir = path.dirname(filePath);
    await mkdir(dir, { recursive: true });
    return writeFile(filePath, content, 'utf-8');
  }

  async append(filePath: string, content: string): Promise<void> {
    // For local filesystem, we read + append + write
    // In production, consider using fs.appendFile for better performance
    try {
      const existing = await this.read(filePath);
      await this.write(filePath, existing + content);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        // File doesn't exist, just write
        await this.write(filePath, content);
      } else {
        throw err;
      }
    }
  }

  async delete(filePath: string): Promise<void> {
    return unlink(filePath);
  }

  join(...segments: string[]): string {
    return segments.join('/');
  }
}
