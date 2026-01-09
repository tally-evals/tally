import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { S2Storage } from '../../adapters/s2';
import { hasS2AccessKey } from '../setup';

describe('S2Storage', () => {
  let storage: S2Storage;
  const testPrefix = `test-${Date.now()}`;
  const createdStreams: string[] = [];

  beforeAll(() => {
    if (!hasS2AccessKey) {
      throw new Error('S2_ACCESS_KEY not found');
    }

    storage = new S2Storage({
      accessToken: process.env.S2_ACCESS_KEY as string,
      basin: 'tally-evals',
    });
  });

  afterAll(async () => {
    // Clean up test streams
    // Note: S2 doesn't have a delete stream API in the SDK yet,
    // so streams will need to be cleaned up manually or via basin deletion
    console.log('Test streams created:', createdStreams);
    createdStreams.forEach(async (stream) => {
      await storage.delete(stream);
    });
    console.log('Test streams deleted:', createdStreams);
  });

  describe('list', () => {
    it('lists streams in a basin', async () => {
      const streamPath = `${testPrefix}/file1.txt`;
      await storage.write(streamPath, 'hello');
      createdStreams.push(streamPath);

      const result = await storage.list('');

      expect(result.length).toBeGreaterThan(0);
      expect(result.some((r) => r.path === streamPath)).toBe(true);
    });

    it('lists streams with prefix', async () => {
      const stream1 = `${testPrefix}/subdir/file1.txt`;
      const stream2 = `${testPrefix}/subdir/file2.txt`;
      const stream3 = `${testPrefix}/other.txt`;

      await storage.write(stream1, 'content1');
      await storage.write(stream2, 'content2');
      await storage.write(stream3, 'content3');

      createdStreams.push(stream1, stream2, stream3);

      const result = await storage.list(`${testPrefix}/subdir`);

      expect(result.some((r) => r.path === stream1)).toBe(true);
      expect(result.some((r) => r.path === stream2)).toBe(true);
      expect(result.some((r) => r.path === stream3)).toBe(false);
    });

    it('extracts directory entries from stream paths', async () => {
      const streamPath = `${testPrefix}/nested/dir/file.txt`;
      await storage.write(streamPath, 'nested content');
      createdStreams.push(streamPath);

      const result = await storage.list(testPrefix);

      // Should include directory entries
      const directories = result.filter((r) => r.isDirectory);
      expect(directories.length).toBeGreaterThan(0);
      expect(directories.some((d) => d.path.includes('nested'))).toBe(true);
    });

    it('returns empty array for non-existent prefix', async () => {
      const result = await storage.list(
        `${testPrefix}/does-not-exist-${Date.now()}`,
      );

      expect(result).toEqual([]);
    });
  });

  describe('stat', () => {
    it('returns isDirectory = false for existing streams', async () => {
      const streamPath = `${testPrefix}/stat-test-file.txt`;
      await storage.write(streamPath, 'content for stat');
      createdStreams.push(streamPath);

      const stat = await storage.stat(streamPath);

      expect(stat).toEqual({ isDirectory: false });
    });

    it('returns isDirectory = true for path prefixes with streams', async () => {
      const streamPath = `${testPrefix}/stat-dir/nested-file.txt`;
      await storage.write(streamPath, 'nested content');
      createdStreams.push(streamPath);

      const stat = await storage.stat(`${testPrefix}/stat-dir`);

      expect(stat).toEqual({ isDirectory: true });
    });

    it('returns null for non-existent paths', async () => {
      const stat = await storage.stat(`${testPrefix}/missing-${Date.now()}`);

      expect(stat).toBeNull();
    });
  });

  describe('read', () => {
    it('reads stream contents as utf-8', async () => {
      const streamPath = `${testPrefix}/read-test.txt`;
      const content = 'hello world from S2';

      await storage.write(streamPath, content);
      createdStreams.push(streamPath);

      const readContent = await storage.read(streamPath);

      expect(readContent).toBe(content);
    });

    it('reads multiple records and joins with newlines', async () => {
      const streamPath = `${testPrefix}/multi-record.txt`;

      // Write multiple times to create multiple records
      await storage.write(streamPath, 'line1');
      await storage.write(streamPath, 'line2');
      await storage.write(streamPath, 'line3');
      createdStreams.push(streamPath);

      const content = await storage.read(streamPath);

      expect(content).toBe('line1\nline2\nline3');
    });

    it('returns empty string for non-existent streams', async () => {
      const content = await storage.read(
        `${testPrefix}/missing-${Date.now()}.txt`,
      );

      expect(content).toBe('');
    });
  });

  describe('write', () => {
    it('creates a new stream and appends content', async () => {
      const streamPath = `${testPrefix}/write-test.txt`;
      const content = 'test content';

      await storage.write(streamPath, content);
      createdStreams.push(streamPath);

      const readContent = await storage.read(streamPath);
      expect(readContent).toBe(content);
    });

    it('appends to existing stream', async () => {
      const streamPath = `${testPrefix}/append-test.txt`;

      await storage.write(streamPath, 'first');
      await storage.write(streamPath, 'second');
      createdStreams.push(streamPath);

      const content = await storage.read(streamPath);
      expect(content).toBe('first\nsecond');
    });
  });

  describe('join', () => {
    it('joins paths using forward slashes', () => {
      const result = storage.join('a', 'b', 'c');

      expect(result).toBe('a/b/c');
    });

    it('filters out empty segments', () => {
      const result = storage.join('a', '', 'b', '', 'c');

      expect(result).toBe('a/b/c');
    });

    it('handles single segment', () => {
      const result = storage.join('single');

      expect(result).toBe('single');
    });
  });
});
