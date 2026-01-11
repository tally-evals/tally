import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { decodeConversation, decodeReport } from '../../src/codecs';
import { TallyStore } from '../../src/store/TallyStore';
import { sampleStepTrace, stepTraceWithToolCall } from '../fixtures/messages';
import type { TrajectoryRunMeta } from '../../src/types/runs';

describe('TallyStore (store layer)', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'tally-store-test-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('createConversation → listConversations → getConversation', async () => {
    const store = await TallyStore.open({
      cwd: tempDir,
      config: { storage: { backend: 'local', path: '.tally' } },
    });

    await store.createConversation('conv-1');

    const conversations = await store.listConversations();
    expect(conversations.map((c) => c.id)).toContain('conv-1');

    const conv = await store.getConversation('conv-1');
    expect(conv?.id).toBe('conv-1');
  });

  it('ConversationRef.save → load round-trips a realistic conversation', async () => {
    const store = await TallyStore.open({
      cwd: tempDir,
      config: { storage: { backend: 'local', path: '.tally' } },
    });

    const convRef = await store.createConversation('travel-planner-golden');

    const jsonl = readFileSync(join(__dirname, '../fixtures/sample-conversation.jsonl'), 'utf-8');
    const conversation = decodeConversation(jsonl);

    await convRef.save(conversation);
    const loaded = await convRef.load();

    expect(loaded.id).toBe('travel-planner-golden');
    expect(loaded.steps.length).toBeGreaterThan(5);
    expect(loaded.steps[0]?.stepIndex).toBe(0);
  });

  it('RunRef.save/load works for tally and trajectory runs', async () => {
    const store = await TallyStore.open({
      cwd: tempDir,
      config: { storage: { backend: 'local', path: '.tally' } },
    });

    const convRef = await store.createConversation('conv-1');

    // Tally run (EvaluationReport)
    const reportJson = readFileSync(join(__dirname, '../fixtures/sample-run.json'), 'utf-8');
    const report = decodeReport(reportJson);

    const tallyRun = await convRef.createRun({ type: 'tally', runId: 'run-tally-1' });
    await tallyRun.save(report);

    const loadedReport = await tallyRun.load();
    expect(tallyRun.type).toBe('tally');
    expect((loadedReport as { runId: string }).runId).toBe(report.runId);

    // Trajectory run (TrajectoryRunMeta)
    const trajectory: TrajectoryRunMeta = {
      runId: 'run-traj-1',
      conversationId: 'conv-1',
      timestamp: new Date('2026-01-01T00:00:00.000Z'),
      goal: 'test goal',
      persona: { description: 'test persona' },
      completed: true,
      reason: 'goal-reached',
      totalTurns: 1,
      metadata: { foo: 'bar' },
    };

    const trajRun = await convRef.createRun({ type: 'trajectory', runId: trajectory.runId });
    await trajRun.save(trajectory);

    const loadedTrajectory = (await trajRun.load()) as TrajectoryRunMeta;
    expect(trajRun.type).toBe('trajectory');
    expect(loadedTrajectory.runId).toBe('run-traj-1');
    expect(loadedTrajectory.metadata?.foo).toBe('bar');
  });

  it('ConversationRef.listRuns returns both tally and trajectory runs', async () => {
    const store = await TallyStore.open({
      cwd: tempDir,
      config: { storage: { backend: 'local', path: '.tally' } },
    });

    const convRef = await store.createConversation('conv-1');

    const tallyRun = await convRef.createRun({ type: 'tally', runId: 'run-tally-1' });
    await tallyRun.save(
      decodeReport(readFileSync(join(__dirname, '../fixtures/sample-run.json'), 'utf-8'))
    );

    const trajRun = await convRef.createRun({ type: 'trajectory', runId: 'run-traj-1' });
    await trajRun.save({
      runId: 'run-traj-1',
      conversationId: 'conv-1',
      timestamp: new Date('2026-01-01T00:00:00.000Z'),
      goal: 'test goal',
      persona: { description: 'test persona' },
      completed: true,
      reason: 'goal-reached',
      totalTurns: 1,
    } satisfies TrajectoryRunMeta);

    const runs = await convRef.listRuns();
    const byId = new Map(runs.map((r) => [r.id, r.type]));

    expect(byId.get('run-tally-1')).toBe('tally');
    expect(byId.get('run-traj-1')).toBe('trajectory');
  });

  it('save/load trajectory meta + step traces by trajectoryId', async () => {
    const store = await TallyStore.open({
      cwd: tempDir,
      config: { storage: { backend: 'local', path: '.tally' } },
    });

    const trajectoryId = 'traj-1';

    await store.saveTrajectoryMeta(trajectoryId, {
      version: 1,
      trajectoryId,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      goal: 'test goal',
      persona: { description: 'test persona' },
      maxTurns: 5,
      loopDetection: { maxConsecutiveSameStep: 3, maxCycleLength: 3, maxCycleRepetitions: 2 },
      stepGraph: {
        start: 'step-0',
        terminals: ['step-1'],
        steps: [{ id: 'step-0' }, { id: 'step-1' }],
      },
      metadata: { foo: 'bar' },
    });

    await store.saveTrajectoryStepTraces(trajectoryId, [sampleStepTrace, stepTraceWithToolCall]);

    const loadedMeta = await store.loadTrajectoryMeta(trajectoryId);
    expect(loadedMeta?.trajectoryId).toBe(trajectoryId);
    expect(loadedMeta?.createdAt).toEqual(new Date('2026-01-01T00:00:00.000Z'));
    expect(loadedMeta?.metadata && (loadedMeta.metadata as any).foo).toBe('bar');

    const loadedTraces = await store.loadTrajectoryStepTraces(trajectoryId);
    expect(loadedTraces).toHaveLength(2);
    expect(loadedTraces?.[0]?.stepId).toBe('step-0');
    expect(loadedTraces?.[0]?.selection.method).toBe('start');
  });
});
