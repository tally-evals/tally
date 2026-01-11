import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { decodeConversation, encodeConversation } from '../../src/codecs';
import { LocalStorage, createStorage } from '../../src/storage';

describe('LocalStorage', () => {
  let tempDir: string;
  let storage: LocalStorage;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'tally-test-'));
    storage = new LocalStorage();
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('write → read returns content', async () => {
    const filePath = join(tempDir, 'test-file.txt');

    await storage.write(filePath, 'hello world');
    const content = await storage.read(filePath);

    expect(content).toBe('hello world');
  });

  it('append adds content to existing file', async () => {
    const filePath = join(tempDir, 'append-test.txt');

    await storage.append(filePath, 'line1\n');
    await storage.append(filePath, 'line2\n');

    const content = await storage.read(filePath);
    expect(content).toBe('line1\nline2\n');
  });

  it('list returns directory entries', async () => {
    const subDir = join(tempDir, 'subdir');
    await storage.write(join(subDir, 'file1.txt'), 'content1');
    await storage.write(join(subDir, 'file2.txt'), 'content2');

    const entries = await storage.list(subDir);

    expect(entries).toHaveLength(2);
    expect(entries.map((e) => e.id).sort()).toEqual(['file1.txt', 'file2.txt']);
  });

  it('delete removes file', async () => {
    const filePath = join(tempDir, 'to-delete.txt');
    await storage.write(filePath, 'data');

    const statBefore = await storage.stat(filePath);
    expect(statBefore).not.toBeNull();

    await storage.delete(filePath);

    const statAfter = await storage.stat(filePath);
    expect(statAfter).toBeNull();
  });

  it('handles conversation JSONL files', async () => {
    const conversation = {
      id: 'test-conv',
      steps: [
        {
          stepIndex: 0,
          input: { role: 'user' as const, content: 'Hello' },
          output: [{ role: 'assistant' as const, content: 'Hi!' }],
        },
        {
          stepIndex: 1,
          input: { role: 'user' as const, content: 'How are you?' },
          output: [{ role: 'assistant' as const, content: 'I am fine, thanks!' }],
        },
      ],
    };

    const jsonl = encodeConversation(conversation);
    const filePath = join(tempDir, 'conversations', 'test-conv', 'conversation.jsonl');

    await storage.write(filePath, jsonl);

    const content = await storage.read(filePath);
    const decoded = decodeConversation(content);

    expect(decoded.id).toBe('test-conv');
    expect(decoded.steps).toHaveLength(2);
  });

  it('works with createStorage factory', async () => {
    const factoryStorage = createStorage({
      backend: 'local',
      path: tempDir,
      autoCreate: true,
      s2: { basin: '', accessToken: '' },
      redis: { url: '' },
    });

    expect(factoryStorage).toBeInstanceOf(LocalStorage);

    const filePath = join(tempDir, 'factory-test.txt');
    await factoryStorage.write(filePath, 'data');
    const content = await factoryStorage.read(filePath);
    expect(content).toBe('data');
  });
});
