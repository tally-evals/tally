import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { decodeConversation, encodeConversation } from '../../src/codecs';
import { RedisStorage } from '../../src/storage';

/**
 * Redis Storage E2E Tests
 *
 * Requires Redis running on localhost:6379
 * Start with: docker compose up -d redis
 */

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';
const TEST_PREFIX = `tally-test-${Date.now()}:`;

// Skip if Redis is not available
const canConnect = async (): Promise<boolean> => {
  try {
    const Redis = await import('ioredis');
    const client = new Redis.default(REDIS_URL, {
      maxRetriesPerRequest: 1,
      retryStrategy: () => null, // Don't retry
      lazyConnect: true,
    });
    await client.connect();
    await client.ping();
    await client.quit();
    return true;
  } catch {
    return false;
  }
};

describe('RedisStorage', async () => {
  const isAvailable = await canConnect();

  if (!isAvailable) {
    it.skip('Redis not available - skipping tests', () => {});
    return;
  }

  let storage: RedisStorage;

  beforeAll(() => {
    storage = new RedisStorage({
      url: REDIS_URL,
      keyPrefix: TEST_PREFIX,
    });
  });

  afterAll(async () => {
    // Cleanup test keys
    try {
      const Redis = await import('ioredis');
      const client = new Redis.default(REDIS_URL);
      const keys = await client.keys(`${TEST_PREFIX}*`);
      if (keys.length > 0) {
        await client.del(...keys);
      }
      await client.quit();
    } catch {
      // Ignore cleanup errors
    }
    await storage.close();
  });

  it('write → read returns content', async () => {
    const filePath = 'test/file.txt';

    await storage.write(filePath, 'hello world');
    const content = await storage.read(filePath);

    expect(content).toBe('hello world');
  });

  it('append adds content to existing stream', async () => {
    const filePath = 'test/append.txt';

    await storage.write(filePath, 'line1');
    await storage.append(filePath, 'line2');

    const content = await storage.read(filePath);
    expect(content).toBe('line1\nline2');
  });

  it('list returns entries', async () => {
    await storage.write('list-test/file1.txt', 'content1');
    await storage.write('list-test/file2.txt', 'content2');

    const entries = await storage.list('list-test');

    expect(entries.length).toBeGreaterThanOrEqual(2);
    const ids = entries.map((e) => e.id);
    expect(ids).toContain('file1.txt');
    expect(ids).toContain('file2.txt');
  });

  it('delete removes key', async () => {
    const filePath = 'test/to-delete.txt';
    await storage.write(filePath, 'data');

    const statBefore = await storage.stat(filePath);
    expect(statBefore).not.toBeNull();

    await storage.delete(filePath);

    const content = await storage.read(filePath);
    expect(content).toBe('');
  });

  it('handles conversation JSONL', async () => {
    const conversation = {
      id: 'redis-conv',
      steps: [
        {
          stepIndex: 0,
          input: { role: 'user' as const, content: 'Hello' },
          output: [{ role: 'assistant' as const, content: 'Hi!' }],
        },
      ],
    };

    const jsonl = encodeConversation(conversation);
    const filePath = 'conversations/redis-conv/conversation.jsonl';

    await storage.write(filePath, jsonl);

    const content = await storage.read(filePath);
    const decoded = decodeConversation(content);

    expect(decoded.id).toBe('redis-conv');
    expect(decoded.steps).toHaveLength(1);
  });

  it('join creates valid paths', () => {
    expect(storage.join('a', 'b', 'c')).toBe('a/b/c');
    expect(storage.join('', 'b')).toBe('b');
  });
});
