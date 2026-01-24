/**
 * Scorer Type Definitions
 *
 * Types for combining multiple metrics into derived scores.
 * Scorers weight and combine normalized metric scores.
 */

import type {
  MetricScalar,
  Score,
  MetricDef,
  MetricContainer,
  BaseMetricDef,
} from './metrics';
import type {
  NormalizationContextFor,
  NormalizerSpec,
  NormalizeToScore,
} from './normalization';

// ============================================================================
// Scorer Input Types
// ============================================================================

/**
 * Input configuration for a Scorer.
 *
 * Defines how a metric contributes to a combined score.
 *
 * @typeParam TMetric - The metric definition type being combined
 * @typeParam TNormContext - Normalization context type
 *
 * @example
 * ```typescript
 * const input = defineInput({
 *   metric: relevanceMetric,
 *   weight: 0.4,
 * });
 * ```
 *
 * @see {@link Scorer}
 * @see {@link defineInput}
 */
export interface ScorerInput<
  TMetric extends MetricDef<MetricScalar, MetricContainer> = MetricDef<
    MetricScalar,
    MetricContainer
  >,
  TNormContext = NormalizationContextFor<MetricScalar>,
> {
  /** The metric definition to include in scoring */
  metric: TMetric;
  /** Relative weight for this input */
  weight: number;
  /**
   * Optional normalizer to override the metric's default.
   * Must be compatible with the metric's value type.
   */
  normalizerOverride?: TMetric extends MetricDef<infer TMetricValue, MetricContainer>
    ?
        | NormalizerSpec<TMetricValue, TNormContext>
        | NormalizeToScore<TMetricValue, TNormContext>
    : never;
  /** Whether this input is required @default true */
  required?: boolean;
}

/**
 * Maps scorer inputs to their normalized Score values by metric name.
 *
 * @typeParam TInputs - The scorer inputs tuple
 */
export type InputScores<TInputs extends readonly ScorerInput[]> = {
  [K in TInputs[number] as K['metric']['name']]: Score;
};

// ============================================================================
// Scorer Definition
// ============================================================================

/**
 * Scorer definition.
 *
 * Combines multiple normalized metrics into a single derived score.
 *
 * @typeParam TInputs - Tuple of scorer input configurations
 *
 * @example
 * ```typescript
 * const scorer = defineScorer({
 *   name: 'QualityScore',
 *   output: { name: 'quality', valueType: 'number' },
 *   inputs: [relevanceInput, accuracyInput],
 * });
 * ```
 *
 * @see {@link ScorerInput}
 * @see {@link defineScorer}
 */
export interface Scorer<
  TInputs extends readonly ScorerInput[] = readonly ScorerInput[],
> {
  /** Unique scorer name */
  name: string;
  /** Human-readable description */
  description?: string;
  /** Output metric definition (always numeric) */
  output: BaseMetricDef<number>;
  /** Input metric configurations */
  inputs: TInputs;
  /** Whether to normalize weights to sum to 1 @default true */
  normalizeWeights?: boolean;
  /** Custom score combination function */
  combineScores?: (scores: InputScores<TInputs>) => Score;
  /** Fallback score when inputs are missing */
  fallbackScore?: Score;
  /** Custom metadata */
  metadata?: Record<string, unknown>;
}
