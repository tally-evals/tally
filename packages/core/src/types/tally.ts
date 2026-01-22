/**
 * Tally Container Type Definition
 *
 * The main evaluation container that orchestrates the entire evaluation flow.
 */

import type { MetricContainer } from './metrics';
import type { Evaluator } from './evaluators';
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
 * Main evaluation container that orchestrates the entire evaluation flow
 * Accepts evaluators (which contain evals) - no aggregators needed
 */
export interface Tally<TContainer extends MetricContainer> {
  data: readonly TContainer[];
  // Allow evaluators over any metric container to avoid variance issues between data and eval targets
  evaluators: readonly Evaluator<MetricContainer>[]; // Changed: no aggregators parameter
  run(options?: TallyRunOptions): Promise<TallyRunReport>;
}
