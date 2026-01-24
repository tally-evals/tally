/**
 * Tally Run Report Types
 *
 * SDK-facing, ergonomic, in-memory representation of a run.
 * Uses the unified result types from results.ts.
 */

import type { Eval } from './evaluators';
import type { ConversationResult, RunDefs } from './results';
import type { TargetRunView } from './runView';
import type { TallyRunArtifact } from './runArtifact';

/**
 * SDK-facing, ergonomic, in-memory representation of a run.
 *
 * - Returned from `tally.run()`
 * - Provides helpers for test DX (e.g. `view()`)
 * - Can be persisted as a schema-stable `TallyRunArtifact` via `toArtifact()`
 *
 * @typeParam TEvals - Tuple of eval definitions (inferred from createTally).
 *                     Enables type-safe access to results with autocomplete.
 */
export interface TallyRunReport<TEvals extends readonly Eval[] = readonly Eval[]> {
  readonly runId: string;
  readonly createdAt: Date;

  readonly defs: RunDefs;

  /**
   * Type-safe result accessors.
   * Keys are literal eval names with autocomplete.
   * Value types are preserved from metric definitions.
   */
  readonly result: ConversationResult<TEvals>;

  readonly metadata?: Record<string, unknown>;

  view(): TargetRunView;
  toArtifact(): TallyRunArtifact;
}
