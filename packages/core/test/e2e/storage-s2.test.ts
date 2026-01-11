import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { S2Storage } from '../../src/storage';

/**
 * S2 Storage E2E Tests
 *
 * Requires S2.dev credentials:
 *   S2_BASIN - S2 basin name
 *   S2_ACCESS_TOKEN - S2 access token
 *
 * These tests are skipped if credentials are not available.
 */

const S2_BASIN = process.env.S2_BASIN;
const S2_ACCESS_TOKEN = process.env.S2_ACCESS_TOKEN;
const TEST_PREFIX = `tally-test-${Date.now()}`;

const hasCredentials = (): boolean => {
  return Boolean(S2_BASIN && S2_ACCESS_TOKEN);
};

describe('S2Storage', () => {
  if (!hasCredentials()) {
    it.skip('S2 credentials not available - skipping tests', () => {});
    return;
  }

  let storage: S2Storage;

  beforeAll(() => {
    // hasCredentials() guard ensures these are present
    const basin = S2_BASIN;
    const accessToken = S2_ACCESS_TOKEN;

    if (!basin || !accessToken) {
      throw new Error('Missing S2 credentials (S2_BASIN, S2_ACCESS_TOKEN)');
    }

    storage = new S2Storage({
      basin,
      accessToken,
    });
  });

  afterAll(async () => {
    // S2 streams are append-only; cleanup by closing streams created during test
    // Note: In production, you'd want a dedicated test basin
    try {
      await storage.delete(`${TEST_PREFIX}/write-test`);
      await storage.delete(`${TEST_PREFIX}/append-test`);
      await storage.delete(`${TEST_PREFIX}/list-test/file1`);
      await storage.delete(`${TEST_PREFIX}/list-test/file2`);
    } catch {
      // Ignore cleanup errors
    }
  });

  it('write → read returns content', async () => {
    const filePath = `${TEST_PREFIX}/write-test`;

    await storage.write(filePath, 'hello s2');
    const content = await storage.read(filePath);

    expect(content).toContain('hello s2');
  });

  it('append adds content', async () => {
    const filePath = `${TEST_PREFIX}/append-test`;

    await storage.append(filePath, 'record1');
    await storage.append(filePath, 'record2');

    const content = await storage.read(filePath);
    expect(content).toContain('record1');
    expect(content).toContain('record2');
  });

  it('list returns stream entries', async () => {
    await storage.write(`${TEST_PREFIX}/list-test/file1`, 'content1');
    await storage.write(`${TEST_PREFIX}/list-test/file2`, 'content2');

    const entries = await storage.list(`${TEST_PREFIX}/list-test`);

    expect(entries.length).toBeGreaterThanOrEqual(2);
  });

  it('stat returns info for existing stream', async () => {
    const filePath = `${TEST_PREFIX}/write-test`;

    const stat = await storage.stat(filePath);

    expect(stat).not.toBeNull();
    expect(stat?.isDirectory).toBe(false);
  });

  it('join creates valid paths', () => {
    expect(storage.join('a', 'b', 'c')).toBe('a/b/c');
    expect(storage.join('', 'b')).toBe('b');
  });
});
