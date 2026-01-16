/**
 * Scorer Type Definitions
 *
 * Types for combining multiple metrics into derived scores.
 */

import type {
  MetricScalar,
  Score,
  MetricDef,
  MetricContainer,
  BaseMetricDef,
} from './metrics';
import type {
  ScoringContext,
  NormalizerSpec,
  NormalizeToScore,
} from './normalization';

// ============================================================================
// Scorer Input Types
// ============================================================================

/**
 * Scorer input definition
 * References a metric definition directly (value-based composition)
 */
export interface ScorerInput<
  M extends MetricDef<MetricScalar, MetricContainer> = MetricDef<
    MetricScalar,
    MetricContainer
  >,
  TContext = ScoringContext,
> {
  metric: M; // Direct reference to the MetricDef being combined
  weight: number;
  // Optional override; metrics own normalization by default.
  // If provided, it must match the raw value type of the referenced metric.
  normalizerOverride?: M extends MetricDef<infer TRawValue, MetricContainer>
    ?
        | NormalizerSpec<TRawValue, TContext>
        | NormalizeToScore<TRawValue, TContext>
    : never;
  required?: boolean; // default true
}

/**
 * Input scores type
 * Maps metric names to their normalized Score values
 */
export type InputScores<TInputs extends readonly ScorerInput[]> = {
  [K in TInputs[number] as K['metric']['name']]: Score;
};

// ============================================================================
// Scorer Definition
// ============================================================================

/**
 * Scorer definition
 * Combines multiple normalized metrics into a single derived metric
 */
export interface Scorer<
  TInputs extends readonly ScorerInput[] = readonly ScorerInput[],
> {
  name: string;
  description?: string;
  output: BaseMetricDef<number>;
  inputs: TInputs;
  normalizeWeights?: boolean; // default true
  combineScores?: (scores: InputScores<TInputs>) => Score; // Optional custom combiner over Scores
  fallbackScore?: Score;
  metadata?: Record<string, unknown>;
}
