/**
 * Evaluator and Eval Type Definitions
 *
 * Types for the Eval API that defines evaluation configurations.
 * Evals wrap metrics with verdict policies and context.
 */

import type {
  MetricScalar,
  Score,
  MetricDef,
  MetricContainer,
  SingleTurnContainer,
  MultiTurnContainer,
} from './metrics';
import type { Scorer } from './scorers';

// ============================================================================
// Run Policy Types
// ============================================================================

/**
 * Controls which targets single-turn metrics evaluate.
 *
 * - `'all'` - Evaluate all targets
 * - `'selectedSteps'` - Evaluate specific conversation steps by index
 * - `'selectedItems'` - Evaluate specific dataset items by index
 */
export type SingleTurnRunPolicy =
  | { run: 'all' }
  | { run: 'selectedSteps'; stepIndices: readonly number[] }
  | { run: 'selectedItems'; itemIndices: readonly number[] };

/**
 * Execution context for evaluators.
 *
 * Provides run policies and optional metadata.
 */
export interface EvaluationContext {
  /** Policy for single-turn metric target selection */
  singleTurn?: SingleTurnRunPolicy;
  /** Custom metadata */
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Verdict Policy Types
// ============================================================================

/**
 * Type-safe verdict policy inferred from metric value type.
 *
 * TypeScript enforces that verdict policy matches the metric's value type.
 *
 * @typeParam TMetricValue - The metric value type
 *
 * @example
 * ```typescript
 * // For boolean metrics
 * const policy: VerdictPolicyFor<boolean> = { kind: 'boolean', passWhen: true };
 *
 * // For number metrics
 * const policy: VerdictPolicyFor<number> = { kind: 'number', type: 'threshold', passAt: 0.8 };
 * ```
 */
export type VerdictPolicyFor<TMetricValue extends MetricScalar> = TMetricValue extends boolean
  ? { kind: 'boolean'; passWhen: true | false }
  : TMetricValue extends number
    ?
        | { kind: 'number'; type: 'threshold'; passAt: number }
        | { kind: 'number'; type: 'range'; min?: number; max?: number }
        | {
            kind: 'custom';
            verdict: (
              score: Score,
              rawValue: number,
            ) => 'pass' | 'fail' | 'unknown';
          }
    : TMetricValue extends string
      ?
          | { kind: 'ordinal'; passWhenIn: readonly string[] }
          | {
              kind: 'custom';
              verdict: (
                score: Score,
                rawValue: string,
              ) => 'pass' | 'fail' | 'unknown';
            }
      :
          | {
              kind: 'custom';
              verdict: (
                score: Score,
                rawValue: TMetricValue,
              ) => 'pass' | 'fail' | 'unknown';
            }
          | { kind: 'none' };

/**
 * Runtime verdict policy union.
 *
 * Used when type inference isn't available.
 */
export type VerdictPolicy =
  | { kind: 'boolean'; passWhen: true | false }
  | { kind: 'number'; type: 'threshold'; passAt: number }
  | { kind: 'number'; type: 'range'; min?: number; max?: number }
  | { kind: 'ordinal'; passWhenIn: readonly string[] }
  | {
      kind: 'custom';
      verdict: (
        score: Score,
        rawValue: MetricScalar,
      ) => 'pass' | 'fail' | 'unknown';
    }
  | { kind: 'none' };

/**
 * Auto-normalization configuration.
 *
 * Applied automatically if metric doesn't specify normalization.
 */
export type AutoNormalizer =
  | { kind: 'boolean'; trueScore?: number; falseScore?: number }
  | { kind: 'ordinal'; weights: Record<string | number, number> }
  | { kind: 'number' };

// ============================================================================
// Eval Types
// ============================================================================

/**
 * Base eval properties shared across all eval kinds.
 *
 * @typeParam TName - Literal string type for eval name (enables type-safe report access)
 */
interface EvalBase<TName extends string = string> {
  /** Unique eval name (preserved as literal type for type-safe reports) */
  readonly name: TName;
  /** Human-readable description */
  description?: string;
  /** Execution context with run policies */
  context?: EvaluationContext;
  /** Custom metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Single-turn eval definition.
 *
 * Evaluates individual targets (DatasetItem or ConversationStep).
 * Results are aggregated across all targets.
 *
 * @typeParam TName - Literal string type for eval name
 * @typeParam TContainer - Container type (ConversationStep or DatasetItem)
 * @typeParam TMetricValue - Metric value type (number, boolean, or string)
 *
 * @example
 * ```typescript
 * const eval = defineSingleTurnEval({
 *   name: 'relevance',
 *   metric: relevanceMetric,
 *   verdict: thresholdVerdict(0.8),
 * });
 * ```
 *
 * @see {@link defineSingleTurnEval}
 */
export interface SingleTurnEval<
  TName extends string = string,
  TContainer extends SingleTurnContainer = SingleTurnContainer,
  TMetricValue extends MetricScalar = MetricScalar,
> extends EvalBase<TName> {
  /** Eval kind discriminator */
  readonly kind: 'singleTurn';
  /** The metric to evaluate */
  metric: MetricDef<TMetricValue, TContainer>;
  /** Verdict policy (type-safe, inferred from metric) */
  verdict?: VerdictPolicyFor<TMetricValue>;
  /** Override auto-normalization for boolean/ordinal metrics */
  autoNormalize?: AutoNormalizer;
}

/**
 * Multi-turn eval definition.
 *
 * Evaluates entire conversations.
 * Results are aggregated across conversations.
 *
 * @typeParam TName - Literal string type for eval name
 * @typeParam TContainer - Container type (Conversation)
 * @typeParam TMetricValue - Metric value type (number, boolean, or string)
 *
 * @example
 * ```typescript
 * const eval = defineMultiTurnEval({
 *   name: 'goalCompletion',
 *   metric: goalCompletionMetric,
 *   verdict: thresholdVerdict(0.7),
 * });
 * ```
 *
 * @see {@link defineMultiTurnEval}
 */
export interface MultiTurnEval<
  TName extends string = string,
  TContainer extends MultiTurnContainer = MultiTurnContainer,
  TMetricValue extends MetricScalar = MetricScalar,
> extends EvalBase<TName> {
  /** Eval kind discriminator */
  readonly kind: 'multiTurn';
  /** The metric to evaluate */
  metric: MetricDef<TMetricValue, TContainer>;
  /** Verdict policy (type-safe, inferred from metric) */
  verdict?: VerdictPolicyFor<TMetricValue>;
  /** Override auto-normalization */
  autoNormalize?: AutoNormalizer;
}

/**
 * Scorer eval definition.
 *
 * Combines multiple metrics using a scorer.
 * Always produces numeric Score output.
 *
 * @typeParam TName - Literal string type for eval name
 *
 * @example
 * ```typescript
 * const eval = defineScorerEval({
 *   name: 'qualityScore',
 *   scorer: qualityScorer,
 *   verdict: thresholdVerdict(0.75),
 * });
 * ```
 *
 * @see {@link defineScorerEval}
 */
export interface ScorerEval<TName extends string = string> extends EvalBase<TName> {
  /** Eval kind discriminator */
  readonly kind: 'scorer';
  /** Scorer definition */
  scorer: Scorer;
  /** Verdict policy (always number-based) */
  verdict?: VerdictPolicyFor<number>;
}

/**
 * Union of all eval types.
 *
 * Used for collections and storage. Uses `any` for TMetricValue due to
 * TypeScript's invariance with nested generics. Type safety is preserved
 * through factory functions that enforce correct types at creation time.
 *
 * @typeParam TName - Literal string type for eval name
 *
 * @see {@link SingleTurnEval}
 * @see {@link MultiTurnEval}
 * @see {@link ScorerEval}
 */
export type Eval<
  TName extends string = string,
  // biome-ignore lint/suspicious/noExplicitAny: Required for variance - see TSDoc above
  _TContainer extends MetricContainer = MetricContainer,
> =
  // biome-ignore lint/suspicious/noExplicitAny: Required for variance
  | SingleTurnEval<TName, SingleTurnContainer, any>
  // biome-ignore lint/suspicious/noExplicitAny: Required for variance
  | MultiTurnEval<TName, MultiTurnContainer, any>
  | ScorerEval<TName>;

