import type { ConversationResult, RunDefs, TallyRunArtifact } from './runArtifact';
import type { TargetRunView } from './runView';

/**
 * SDK-facing, ergonomic, in-memory representation of a run.
 *
 * - Returned from `tally.run()`
 * - Provides helpers for test DX (e.g. `view()`)
 * - Can be persisted as a schema-stable `TallyRunArtifact` via `toArtifact()`
 */
export interface TallyRunReport {
  readonly runId: string;
  readonly createdAt: Date;

  readonly defs: RunDefs;
  readonly result: ConversationResult;
  readonly metadata?: Record<string, unknown>;

  view(): TargetRunView;
  toArtifact(): TallyRunArtifact;
}

