/**
 * Normalization Type Definitions
 *
 * Types for normalizing raw metric values to Score [0, 1] range.
 */

import type { MetricScalar, Score } from './primitives';

// ============================================================================
// Scoring Context
// ============================================================================

/**
 * Scoring context for normalization
 * Provides metadata needed for normalization algorithms
 */
export interface ScoringContext {
  direction?: 'higher' | 'lower';
  range?: { min: number; max: number };
  distribution?: { mean: number; stdDev: number };
  thresholds?: { pass: number; warn?: number };
  ordinalMap?: Record<string | number, number>;
  unit?: string;
  clip?: boolean;
  extra?: Record<string, unknown>;
}

// ============================================================================
// Normalizer Types
// ============================================================================

/**
 * Minimal metric info needed for normalization
 * This avoids circular dependency with full MetricDef
 */
export interface MetricInfo {
  name: string;
  valueType: string;
  metadata?: Record<string, unknown>;
}

/**
 * Normalization function type
 * Transforms a raw metric value to a Score [0, 1]
 */
export type NormalizeToScore<
  TRawValue extends MetricScalar = number,
  TContext = unknown,
> = (
  value: TRawValue,
  args: { context: TContext; metric: MetricInfo },
) => Score; // must return [0,1] Score

/**
 * Normalizer specification
 * Discriminated union of all normalizer types
 */
export type NormalizerSpec<
  TRawValue extends MetricScalar = MetricScalar,
  TContext = unknown,
> =
  | { type: 'identity' }
  | {
      type: 'min-max';
      min?: number;
      max?: number;
      clip?: boolean;
      direction?: 'higher' | 'lower';
    }
  | {
      type: 'z-score';
      mean?: number;
      stdDev?: number;
      to?: '0-1' | '0-100';
      clip?: boolean;
      direction?: 'higher' | 'lower';
    }
  | { type: 'threshold'; threshold: number; above?: number; below?: number }
  | {
      type: 'linear';
      slope: number;
      intercept: number;
      clip?: [number, number];
      direction?: 'higher' | 'lower';
    }
  | { type: 'ordinal-map'; map: Record<string | number, number> }
  | { type: 'custom'; normalize: NormalizeToScore<TRawValue, TContext> };

/**
 * Metric normalization configuration
 * Defines default normalizer and optional context resolver
 */
export interface MetricNormalization<
  TRawValue extends MetricScalar = MetricScalar,
  TContext = ScoringContext,
> {
  default:
    | NormalizerSpec<TRawValue, TContext>
    | NormalizeToScore<TRawValue, TContext>;
  context?:
    | TContext
    | ((args: {
        dataset: readonly unknown[];
        rawValues: readonly TRawValue[];
      }) => Promise<TContext> | TContext);
}
