/**
 * Evaluator and Eval Type Definitions
 *
 * Types for the Eval API that defines evaluation configurations.
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
 * Single-turn run policy
 * Controls which targets single-turn metrics evaluate
 */
export type SingleTurnRunPolicy =
  | { run: 'all' }
  | { run: 'selectedSteps'; stepIndices: readonly number[] }
  | { run: 'selectedItems'; itemIndices: readonly number[] };

/**
 * Evaluation context
 * Provides execution context for evaluators
 */
export interface EvaluationContext {
  singleTurn?: SingleTurnRunPolicy;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Verdict Policy Types
// ============================================================================

/**
 * Type-safe verdict policy inferred from metric value type
 * TypeScript enforces that verdict policy matches the metric's value type
 */
export type VerdictPolicyFor<T extends MetricScalar> = T extends boolean
  ? { kind: 'boolean'; passWhen: true | false }
  : T extends number
    ?
        | { kind: 'number'; type: 'threshold'; passAt: number } // Score >= passAt
        | { kind: 'number'; type: 'range'; min?: number; max?: number } // min <= Score <= max
        | {
            kind: 'custom';
            verdict: (
              score: Score,
              rawValue: number,
            ) => 'pass' | 'fail' | 'unknown';
          }
    : T extends string
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
                rawValue: T,
              ) => 'pass' | 'fail' | 'unknown';
            }
          | { kind: 'none' };

/**
 * Union type for runtime use (when type inference isn't available)
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
 * Auto-normalization for boolean/ordinal metrics
 * Applied automatically if metric doesn't specify normalization
 */
export type AutoNormalizer =
  | { kind: 'boolean'; trueScore?: number; falseScore?: number } // default: 1.0/0.0
  | { kind: 'ordinal'; weights: Record<string | number, number> } // required map
  | { kind: 'number' }; // identity or use metric's normalization

// ============================================================================
// Eval Types
// ============================================================================

/**
 * Base eval properties shared across all eval kinds
 */
interface EvalBase {
  name: string;
  description?: string;
  context?: EvaluationContext; // For single-turn run policies
  metadata?: Record<string, unknown>;
}

/**
 * Single-turn eval: single metric evaluated per target
 * Results are aggregated across all targets (mean, percentiles, pass/fail rates)
 * Type-safe: verdict policy type is inferred from metric value type
 */
export interface SingleTurnEval<
  TContainer extends SingleTurnContainer,
  TMetricValue extends MetricScalar = MetricScalar,
> extends EvalBase {
  kind: 'singleTurn';
  metric: MetricDef<TMetricValue, TContainer>; // Single metric - type inferred
  verdict?: VerdictPolicyFor<TMetricValue>; // Type-safe verdict (inferred from metric)
  autoNormalize?: AutoNormalizer; // Override auto-normalization for boolean/ordinal
}

/**
 * Multi-turn eval: single metric evaluated per conversation
 * Results are aggregated across conversations (mean, percentiles, pass/fail rates)
 * Type-safe: verdict policy type is inferred from metric value type
 */
export interface MultiTurnEval<
  TContainer extends MultiTurnContainer,
  TMetricValue extends MetricScalar = MetricScalar,
> extends EvalBase {
  kind: 'multiTurn';
  metric: MetricDef<TMetricValue, TContainer>; // Single metric - type inferred
  verdict?: VerdictPolicyFor<TMetricValue>; // Type-safe verdict (inferred from metric)
  autoNormalize?: AutoNormalizer; // Override auto-normalization
}

/**
 * Scorer eval: combines multiple metrics using a scorer
 * Produces normalized Score output (number)
 * Verdict policy is always number-based since Score is number
 */
export interface ScorerEval extends EvalBase {
  kind: 'scorer';
  scorer: Scorer; // Scorer definition (outputs normalized Score)
  verdict?: VerdictPolicyFor<number>; // Always number-based (Score is number)
}

/**
 * Union of all eval types for collection/storage
 * 
 * Uses `any` for TMetricValue due to TypeScript's invariance with nested generics:
 * - Aggregator<TValue> has TValue in function parameter position (invariant)
 * - This makes SingleTurnEval<C, number> incompatible with SingleTurnEval<C, MetricScalar>
 * - Individual evals retain full type safety; only the collection type uses `any`
 * 
 * Type safety is preserved because:
 * 1. Factory functions (defineSingleTurnEval, etc.) infer and enforce correct types
 * 2. VerdictPolicy is type-checked at eval creation time
 * 3. The pipeline handles type coercion safely at runtime
 */
// biome-ignore lint/suspicious/noExplicitAny: Required for variance - see comment above
export type Eval<_TContainer extends MetricContainer = MetricContainer> =
  // biome-ignore lint/suspicious/noExplicitAny: Required for variance - see comment above
  | SingleTurnEval<SingleTurnContainer, any>
  // biome-ignore lint/suspicious/noExplicitAny: Required for variance - see comment above
  | MultiTurnEval<MultiTurnContainer, any>
  | ScorerEval;

// ============================================================================
// Evaluator Type
// ============================================================================

/**
 * Evaluator definition
 * Accepts evals instead of metrics/scorers directly
 * Defines context that applies to all evals within it
 */
export interface Evaluator<TContainer extends MetricContainer> {
  name: string;
  description?: string;
  evals: readonly Eval<TContainer>[]; // Changed from metrics + scorer
  context: EvaluationContext; // REQUIRED: Context applies to all evals in this evaluator
  metadata?: Record<string, unknown>;
}
