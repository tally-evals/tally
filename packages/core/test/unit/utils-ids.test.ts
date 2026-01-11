import { describe, expect, it } from 'bun:test';
import {
  extractTimestampFromId,
  generateConversationId,
  generateRunId,
  generateTrajectoryId,
} from '../../src/utils';

describe('generateRunId', () => {
  it('generates unique IDs with run- prefix and timestamp', () => {
    const id1 = generateRunId();
    const id2 = generateRunId();

    expect(id1).toMatch(/^run-\d+-[a-z0-9]+$/);
    expect(id2).toMatch(/^run-\d+-[a-z0-9]+$/);
    expect(id1).not.toBe(id2);
  });
});

describe('generateConversationId', () => {
  it('generates unique IDs with conv- prefix', () => {
    const id = generateConversationId();
    expect(id).toMatch(/^conv-\d+-[a-z0-9]+$/);
  });
});

describe('generateTrajectoryId', () => {
  it('generates unique IDs with traj- prefix', () => {
    const id = generateTrajectoryId();
    expect(id).toMatch(/^traj-\d+-[a-z0-9]+$/);
  });
});

describe('extractTimestampFromId', () => {
  it('extracts timestamp from run ID as Date', () => {
    const timestamp = 1767864765136;
    const id = `run-${timestamp}-8zeeq5q`;
    const extracted = extractTimestampFromId(id);

    expect(extracted).toBeInstanceOf(Date);
    expect(extracted?.getTime()).toBe(timestamp);
  });

  it('extracts timestamp from conversation ID as Date', () => {
    const timestamp = 1767864765136;
    const id = `conv-${timestamp}-abc123`;
    const extracted = extractTimestampFromId(id);

    expect(extracted).toBeInstanceOf(Date);
    expect(extracted?.getTime()).toBe(timestamp);
  });

  it('returns null for invalid format', () => {
    expect(extractTimestampFromId('invalid-id')).toBeNull();
    expect(extractTimestampFromId('run-abc-123')).toBeNull();
    expect(extractTimestampFromId('')).toBeNull();
  });
});
