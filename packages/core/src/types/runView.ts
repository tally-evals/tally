/**
 * Target Run View Types
 *
 * Type-safe view for accessing run results.
 * All methods are lazy projections over the underlying result data.
 */

import type { Eval } from './evaluators';
import type {
  StepResults,
  StepResultsWithIndex,
  ConversationResults,
  SummaryResults,
  ExtractEvalName,
  RunDefs,
  MetricDefSnap,
  EvalDefSnap,
  ScorerDefSnap,
} from './results';

/**
 * Type-safe view for accessing run results.
 *
 * Provides ergonomic, type-safe accessors over result data:
 * - `step(i)` - Get results for a specific step with eval name autocomplete
 * - `steps()` - Generator for iterating all steps
 * - `conversation()` - Get conversation-level results
 * - `summary()` - Get aggregated summaries
 *
 * Also provides definition resolution:
 * - `eval(name)` - Get eval definition
 * - `metric(name)` - Get metric definition
 * - `scorer(name)` - Get scorer definition
 *
 * @typeParam TEvals - Tuple of eval definitions for type-safe access.
 */
export interface TargetRunView<TEvals extends readonly Eval[] = readonly Eval[]> {
  /** Total number of steps in the conversation */
  readonly stepCount: number;

  // ─────────────────────────────────────────────────────────────────────────
  // Result Accessors
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get step results by index.
   * @param index - Step index (0-based)
   * @returns Type-safe step results with eval name autocomplete
   */
  step(index: number): StepResults<TEvals>;

  /**
   * Generator for iterating all steps.
   * Lazy evaluation - builds each step result on demand.
   * @yields Step results with index property
   */
  steps(): Generator<StepResultsWithIndex<TEvals>, void, unknown>;

  /**
   * Get conversation-level results.
   * Includes multi-turn evals and scalar scorers.
   * @returns Type-safe conversation results with eval name autocomplete
   */
  conversation(): ConversationResults<TEvals>;

  /**
   * Get summary/aggregation results.
   * @returns Summary results keyed by eval name, or undefined if not computed
   */
  summary(): SummaryResults<TEvals> | undefined;

  // ─────────────────────────────────────────────────────────────────────────
  // Definition Accessors (Reference Resolution)
  // ─────────────────────────────────────────────────────────────────────────

  /** All definitions (metrics, evals, scorers) */
  readonly defs: RunDefs;

  /** Resolve metric definition by name */
  metric(name: string): MetricDefSnap | undefined;

  /** Resolve eval definition by name (type-safe) */
  eval<K extends ExtractEvalName<TEvals[number]>>(name: K): EvalDefSnap | undefined;

  /** Resolve scorer definition by name */
  scorer(name: string): ScorerDefSnap | undefined;

  /**
   * Get metric definition for an eval.
   * Shorthand for: metric(eval(evalName)?.metric)
   */
  metricForEval<K extends ExtractEvalName<TEvals[number]>>(
    evalName: K
  ): MetricDefSnap | undefined;
}
