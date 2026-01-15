/**
 * Eval API Type Definitions
 *
 * Core types for the new Eval API that replaces the metrics/scorer/aggregator pattern
 * with a unified eval abstraction that includes built-in aggregations and verdict policies.
 */

import type {
  MetricDef,
  MetricScalar,
  MetricContainer,
  SingleTurnContainer,
  MultiTurnContainer,
  SingleTurnMetricDef,
  MultiTurnMetricDef,
  Score,
  EvaluationContext,
  Scorer,
  Aggregator,
} from '@tally/core/types';

/**
 * Helper to infer metric value type from metric definition
 */
export type MetricValueType<
  T extends MetricDef<MetricScalar, SingleTurnContainer>,
> = T extends MetricDef<infer TRawValue, SingleTurnContainer>
  ? TRawValue
  : never;

/**
 * Container-specific helpers to keep constraints tight per factory
 */
export type MetricValueTypeSingle<
  T extends MetricDef<MetricScalar, SingleTurnContainer>,
> = T extends MetricDef<infer TRawValue, SingleTurnContainer>
  ? TRawValue
  : never;

export type MetricValueTypeMulti<
  T extends MetricDef<MetricScalar, MultiTurnContainer>,
> = T extends MetricDef<infer TRawValue, MultiTurnContainer>
  ? TRawValue
  : never;

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
          verdict: (score: Score, rawValue: T) => 'pass' | 'fail' | 'unknown';
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
  aggregators?: Aggregator[];
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
  // Allow mixing single-turn and multi-turn metrics in scorer inputs
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  inputs: readonly (
    | SingleTurnMetricDef<any, any>
    | MultiTurnMetricDef<any, any>
  )[]; // Input metrics (can be multiple)
  scorer: Scorer; // Scorer definition (outputs normalized Score)
  verdict?: VerdictPolicyFor<number>; // Always number-based (Score is number)
}

export type Eval<_TContainer extends MetricContainer = MetricContainer> =
  // Simplified to direct union to avoid conditional type distribution issues
  // The execution layer handles container selection, so this is safe
  // Accept any raw value type to avoid variance issues with concrete metrics
  // _TContainer parameter kept for API compatibility but not used in union
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  | SingleTurnEval<SingleTurnContainer, any>
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  | MultiTurnEval<MultiTurnContainer, any>
  | ScorerEval;
