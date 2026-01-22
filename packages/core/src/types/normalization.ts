/**
 * Normalization Type Definitions
 *
 * Types for normalizing raw metric values to Score [0, 1] range.
 */

import type { MetricScalar, Score } from './primitives';

// ============================================================================
// Normalization Context (typed by metric value type)
// ============================================================================

/**
 * Normalization context for number-valued metrics.
 *
 * This is typically produced by `calibrate` (static or dataset-derived) and/or
 * consumed by numeric normalizers (min-max, z-score, threshold, linear).
 */
export interface NumericNormalizationContext {
  direction?: 'higher' | 'lower';
  range?: { min: number; max: number };
  distribution?: { mean: number; stdDev: number };
  thresholds?: { pass: number; warn?: number };
  unit?: string;
  clip?: boolean;
}

/**
 * Normalization context for boolean-valued metrics.
 *
 * Useful for custom normalizers that want to map true/false to configurable scores.
 */
export interface BooleanNormalizationContext {
  trueScore?: number; // default 1
  falseScore?: number; // default 0
}

/**
 * Normalization context for string/ordinal-valued metrics.
 */
export interface OrdinalNormalizationContext {
  map?: Record<string, number>; // values must be in [0,1]
}

/**
 * Map a raw metric value type to its corresponding normalization context type.
 */
export type NormalizationContextFor<T extends MetricScalar> = T extends number
  ? NumericNormalizationContext
  : T extends boolean
    ? BooleanNormalizationContext
    : OrdinalNormalizationContext;

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
  TContext = NormalizationContextFor<TRawValue>,
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
  TContext = NormalizationContextFor<TRawValue>,
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
  | { type: 'ordinal-map'; map: Record<string, number> }
  | { type: 'custom'; normalize: NormalizeToScore<TRawValue, TContext> };

/**
 * Metric normalization configuration
 * Defines the metric normalizer and optional calibration resolver.
 */
export interface MetricNormalization<
  TRawValue extends MetricScalar = MetricScalar,
  TContext = NormalizationContextFor<TRawValue>,
> {
  normalizer:
    | NormalizerSpec<TRawValue, TContext>
    | NormalizeToScore<TRawValue, TContext>;
  calibrate?:
    | TContext
    | ((args: {
        dataset: readonly unknown[];
        rawValues: readonly TRawValue[];
      }) => Promise<TContext> | TContext);
}
