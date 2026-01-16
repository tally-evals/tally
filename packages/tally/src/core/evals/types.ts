/**
 * Eval API Type Definitions
 *
 * Re-exports eval types from @tally-evals/core and provides local helper types.
 */

import type {
  MetricDef,
  MetricScalar,
  MultiTurnContainer,
  SingleTurnContainer,
} from '@tally-evals/core';

// Re-export all eval types from core
export type {
  VerdictPolicyFor,
  VerdictPolicy,
  AutoNormalizer,
  SingleTurnEval,
  MultiTurnEval,
  ScorerEval,
  Eval,
} from '@tally-evals/core';

/**
 * Helper to infer metric value type from metric definition
 */
export type MetricValueType<T extends MetricDef<MetricScalar, SingleTurnContainer>> =
  T extends MetricDef<infer TRawValue, SingleTurnContainer> ? TRawValue : never;

/**
 * Container-specific helpers to keep constraints tight per factory
 */
export type MetricValueTypeSingle<T extends MetricDef<MetricScalar, SingleTurnContainer>> =
  T extends MetricDef<infer TRawValue, SingleTurnContainer> ? TRawValue : never;

export type MetricValueTypeMulti<T extends MetricDef<MetricScalar, MultiTurnContainer>> =
  T extends MetricDef<infer TRawValue, MultiTurnContainer> ? TRawValue : never;
