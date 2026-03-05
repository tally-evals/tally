/**
 * Tally Container Type Definition
 *
 * The main evaluation container that orchestrates the entire evaluation flow.
 */

import type { MetricContainer } from './metrics';
import type { Eval, EvaluationContext } from './evaluators';
import type { TallyRunReport } from './runReport';

/**
 * Options for `tally.run()`.
 *
 * Note: This lives in `@tally-evals/core` because consumers type against the `Tally` interface.
 * The exact cache type is intentionally left as `unknown` (implementation detail of the SDK).
 */
export interface TallyRunOptions {
  cache?: unknown;
  llmOptions?: {
    maxRetries?: number;
    temperature?: number;
  };
  metadata?: Record<string, unknown>;
}

/**
 * Tally container
 * Main evaluation container that orchestrates the entire evaluation flow.
 *
 * @typeParam TContainer - DatasetItem or Conversation
 * @typeParam TEvals - Tuple of eval definitions (inferred from createTally).
 *                     Enables type-safe report access with autocomplete.
 */
export interface Tally<
  TContainer extends MetricContainer,
  TEvals extends readonly Eval[] = readonly Eval[],
> {
  readonly data: readonly TContainer[];

  /** Array of evals to run */
  readonly evals: TEvals;

  /** Optional shared context for all evals */
  readonly context?: EvaluationContext;

  /**
   * Run the evaluation pipeline.
   * Returns a type-safe report with autocomplete for eval names.
   */
  run(options?: TallyRunOptions): Promise<TallyRunReport<TEvals>>;
}
