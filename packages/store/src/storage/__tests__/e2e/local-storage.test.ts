import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm, readFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { LocalStorage } from '../../adapters/local';

describe('LocalStorage', () => {
  let storage: LocalStorage;
  let tmpDir: string;

  beforeEach(async () => {
    storage = new LocalStorage();
    tmpDir = path.join(
      os.tmpdir(),
      `local-storage-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    await mkdir(tmpDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  describe('list', () => {
    it('lists files and directories in a directory', async () => {
      const filePath = path.join(tmpDir, 'file.txt');
      const dirPath = path.join(tmpDir, 'subdir');

      await writeFile(filePath, 'hello');
      await mkdir(dirPath);

      const result = await storage.list(tmpDir);

      expect(result).toHaveLength(2);

      expect(result).toEqual(
        expect.arrayContaining([
          {
            id: 'file.txt',
            path: path.join(tmpDir, 'file.txt'),
            isDirectory: false,
          },
          {
            id: 'subdir',
            path: path.join(tmpDir, 'subdir'),
            isDirectory: true,
          },
        ]),
      );
    });

    it('returns an empty array if directory does not exist', async () => {
      const result = await storage.list(path.join(tmpDir, 'does-not-exist'));

      expect(result).toEqual([]);
    });
  });

  describe('stat', () => {
    it('returns isDirectory = false for files', async () => {
      const filePath = path.join(tmpDir, 'file.txt');
      await writeFile(filePath, 'content');

      const stat = await storage.stat(filePath);

      expect(stat).toEqual({ isDirectory: false });
    });

    it('returns isDirectory = true for directories', async () => {
      const dirPath = path.join(tmpDir, 'folder');
      await mkdir(dirPath);

      const stat = await storage.stat(dirPath);

      expect(stat).toEqual({ isDirectory: true });
    });

    it('rejects if path does not exist', async () => {
      await expect(
        storage.stat(path.join(tmpDir, 'missing')),
      ).rejects.toBeDefined();
    });
  });

  describe('read', () => {
    it('reads file contents as utf-8', async () => {
      const filePath = path.join(tmpDir, 'file.txt');
      await writeFile(filePath, 'hello world');

      const content = await storage.read(filePath);

      expect(content).toBe('hello world');
    });

    it('rejects if file does not exist', async () => {
      await expect(
        storage.read(path.join(tmpDir, 'missing.txt')),
      ).rejects.toBeDefined();
    });
  });

  describe('write', () => {
    it('writes file contents as utf-8', async () => {
      const filePath = path.join(tmpDir, 'file.txt');
      await storage.write(filePath, 'hello world');

      const content = await readFile(filePath, 'utf-8');

      expect(content).toBe('hello world');
    });

    it('rejects if file does not exist', async () => {
      await expect(
        storage.write(path.join(tmpDir, 'missing.txt'), 'hello world'),
      ).rejects.toBeDefined();
    });
  });

  describe('delete', () => {
    it('deletes file', async () => {
      const filePath = path.join(tmpDir, 'file.txt');
      await writeFile(filePath, 'hello world');

      await storage.delete(filePath);
    });

    it('rejects if file does not exist', async () => {
      await expect(
        storage.delete(path.join(tmpDir, 'missing.txt')),
      ).rejects.toBeDefined();
    });
  });

  describe('join', () => {
    it('joins paths using forward slashes', () => {
      const result = storage.join('a', 'b', 'c');

      expect(result).toBe('a/b/c');
    });

    it('does not normalize or resolve paths', () => {
      const result = storage.join('a/', '/b', 'c');

      expect(result).toBe('a///b/c');
    });
  });
});
