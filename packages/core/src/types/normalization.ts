/**
 * Normalization Type Definitions
 *
 * Types for normalizing raw metric values to Score [0, 1] range.
 * Normalization converts diverse metric outputs into comparable scores.
 */

import type { MetricScalar, Score } from './primitives';

// ============================================================================
// Normalization Context (typed by metric value type)
// ============================================================================

/**
 * Normalization context for number-valued metrics.
 *
 * Provides calibration data for normalizers. Can be static or dataset-derived.
 *
 * @example
 * ```typescript
 * const context: NumericNormalizationContext = {
 *   direction: 'higher',
 *   range: { min: 0, max: 100 },
 *   clip: true,
 * };
 * ```
 */
export interface NumericNormalizationContext {
  /** Whether higher or lower values are better */
  direction?: 'higher' | 'lower';
  /** Value range for min-max normalization */
  range?: { min: number; max: number };
  /** Distribution stats for z-score normalization */
  distribution?: { mean: number; stdDev: number };
  /** Threshold values for pass/warn determination */
  thresholds?: { pass: number; warn?: number };
  /** Unit label for display purposes */
  unit?: string;
  /** Whether to clip values outside the range to [0, 1] */
  clip?: boolean;
}

/**
 * Normalization context for boolean-valued metrics.
 *
 * Maps true/false to configurable score values.
 */
export interface BooleanNormalizationContext {
  /** Score for true values @default 1 */
  trueScore?: number;
  /** Score for false values @default 0 */
  falseScore?: number;
}

/**
 * Normalization context for string/ordinal-valued metrics.
 *
 * Maps categorical values to scores in [0, 1].
 */
export interface OrdinalNormalizationContext {
  /** Mapping of ordinal values to scores (values must be in [0, 1]) */
  map?: Record<string, number>;
}

/**
 * Maps a metric value type to its corresponding normalization context.
 *
 * @typeParam TMetricValue - The metric value type (number, boolean, or string)
 */
export type NormalizationContextFor<TMetricValue extends MetricScalar> = TMetricValue extends number
  ? NumericNormalizationContext
  : TMetricValue extends boolean
    ? BooleanNormalizationContext
    : OrdinalNormalizationContext;

// ============================================================================
// Normalizer Types
// ============================================================================

/**
 * Minimal metric info needed for normalization.
 *
 * Avoids circular dependency with full MetricDef while providing
 * necessary context for custom normalizers.
 */
export interface MetricInfo {
  /** Metric name */
  name: string;
  /** Value type string ('number', 'boolean', 'string', 'ordinal') */
  valueType: string;
  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Custom normalization function signature.
 *
 * Transforms a raw metric value to a normalized Score in [0, 1].
 *
 * @typeParam TMetricValue - The metric value type
 * @typeParam TNormContext - The normalization context type
 */
export type NormalizeToScore<
  TMetricValue extends MetricScalar = number,
  TNormContext = NormalizationContextFor<TMetricValue>,
> = (
  value: TMetricValue,
  args: { context: TNormContext; metric: MetricInfo },
) => Score;

/**
 * Built-in normalizer specification.
 *
 * Discriminated union of all supported normalizer types.
 *
 * @typeParam TMetricValue - The metric value type
 * @typeParam TNormContext - The normalization context type
 *
 * @example
 * ```typescript
 * // Min-max normalization
 * const spec: NormalizerSpec<number> = {
 *   type: 'min-max',
 *   min: 0,
 *   max: 100,
 *   direction: 'higher',
 * };
 * ```
 */
export type NormalizerSpec<
  TMetricValue extends MetricScalar = MetricScalar,
  TNormContext = NormalizationContextFor<TMetricValue>,
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
  | { type: 'custom'; normalize: NormalizeToScore<TMetricValue, TNormContext> };

/**
 * Complete normalization configuration for a metric.
 *
 * Combines a normalizer with optional calibration that can be
 * static or dataset-derived.
 *
 * @typeParam TMetricValue - The metric value type
 * @typeParam TNormContext - The normalization context type
 *
 * @example
 * ```typescript
 * const normalization: MetricNormalization<number> = {
 *   normalizer: { type: 'min-max', direction: 'higher' },
 *   calibrate: async ({ rawValues }) => ({
 *     range: { min: Math.min(...rawValues), max: Math.max(...rawValues) },
 *   }),
 * };
 * ```
 */
export interface MetricNormalization<
  TMetricValue extends MetricScalar = MetricScalar,
  TNormContext = NormalizationContextFor<TMetricValue>,
> {
  /** The normalizer specification or custom function */
  normalizer:
    | NormalizerSpec<TMetricValue, TNormContext>
    | NormalizeToScore<TMetricValue, TNormContext>;
  /**
   * Static context or async function to derive context from dataset.
   * Called before normalization to provide calibration data.
   */
  calibrate?:
    | TNormContext
    | ((args: {
        dataset: readonly unknown[];
        rawValues: readonly TMetricValue[];
      }) => Promise<TNormContext> | TNormContext);
}
