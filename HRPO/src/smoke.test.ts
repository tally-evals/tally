import { describe, expect, test } from 'bun:test';
import { createTally, createTrajectory } from './index';

describe('@tally-evals/hrpo shell', () => {
  test('re-exports from tally and trajectories resolve', () => {
    expect(typeof createTally).toBe('function');
    expect(typeof createTrajectory).toBe('function');
  });
});
