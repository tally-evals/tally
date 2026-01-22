/**
 * Normalizer factory functions
 *
 * Provides convenient factory functions for creating NormalizerSpec objects
 * These functions return properly typed NormalizerSpec values that can be
 * used directly in metric definitions
 */

import type {
  MetricContainer,
  MetricDef,
  MetricScalar,
  NormalizationContextFor,
  NumericNormalizationContext,
  OrdinalNormalizationContext,
  NormalizeToScore,
  NormalizerSpec,
  Score,
} from '@tally/core/types';

/**
 * Create a min-max normalizer specification
 *
 * @param min - Minimum value in the range
 * @param max - Maximum value in the range
 * @param options - Optional configuration (clip, direction)
 * @returns Min-max normalizer spec
 */
export function createMinMaxNormalizer(args: {
  min: number;
  max: number;
  clip?: boolean;
  direction?: 'higher' | 'lower';
}): NormalizerSpec<number, NumericNormalizationContext> {
  const spec: NormalizerSpec<number, NumericNormalizationContext> = {
    type: 'min-max',
    min: args.min,
    max: args.max,
  };
  if (args.clip !== undefined) {
    spec.clip = args.clip;
  }
  if (args.direction !== undefined) {
    spec.direction = args.direction;
  }
  return spec;
}

/**
 * Create a z-score normalizer specification
 *
 * @param mean - Mean value for z-score calculation
 * @param stdDev - Standard deviation for z-score calculation
 * @param options - Optional configuration (clip, direction, to)
 * @returns Z-score normalizer spec
 */
export function createZScoreNormalizer(args: {
  mean: number;
  stdDev: number;
  clip?: boolean;
  direction?: 'higher' | 'lower';
  to?: '0-1' | '0-100';
}): NormalizerSpec<number, NumericNormalizationContext> {
  const spec: NormalizerSpec<number, NumericNormalizationContext> = {
    type: 'z-score',
    mean: args.mean,
    stdDev: args.stdDev,
  };
  if (args.clip !== undefined) {
    spec.clip = args.clip;
  }
  if (args.direction !== undefined) {
    spec.direction = args.direction;
  }
  if (args.to !== undefined) {
    spec.to = args.to;
  }
  return spec;
}

/**
 * Create a threshold normalizer specification
 *
 * @param threshold - Threshold value
 * @param above - Score for values >= threshold (default: 1.0)
 * @param below - Score for values < threshold (default: 0.0)
 * @returns Threshold normalizer spec
 */
export function createThresholdNormalizer(args: {
  threshold: number;
  above?: number;
  below?: number;
}): NormalizerSpec<number, NumericNormalizationContext> {
  // Validate above and below are in [0, 1] range
  const above = args.above ?? 1.0;
  const below = args.below ?? 0.0;
  if (above < 0 || above > 1 || below < 0 || below > 1) {
    throw new Error(
      `Threshold normalizer above (${above}) and below (${below}) must be in [0, 1] range`
    );
  }

  return {
    type: 'threshold',
    threshold: args.threshold,
    above,
    below,
  };
}

/**
 * Create a linear normalizer specification
 *
 * @param slope - Slope of the linear transformation
 * @param intercept - Intercept of the linear transformation
 * @param options - Optional configuration (clip, direction)
 * @returns Linear normalizer spec
 */
export function createLinearNormalizer(args: {
  slope: number;
  intercept: number;
  clip?: [number, number];
  direction?: 'higher' | 'lower';
}): NormalizerSpec<number, NumericNormalizationContext> {
  const spec: NormalizerSpec<number, NumericNormalizationContext> = {
    type: 'linear',
    slope: args.slope,
    intercept: args.intercept,
  };
  if (args.clip !== undefined) {
    spec.clip = args.clip;
  }
  if (args.direction !== undefined) {
    spec.direction = args.direction;
  }
  return spec;
}

/**
 * Create an ordinal map normalizer specification
 *
 * @param map - Mapping from ordinal values (string/number) to scores [0, 1]
 * @returns Ordinal map normalizer spec
 */
export function createOrdinalMapNormalizer(args: {
  map: Record<string, number>;
}): NormalizerSpec<string, OrdinalNormalizationContext> {
  // Validate all mapped values are in [0, 1] range
  for (const [key, value] of Object.entries(args.map)) {
    if (value < 0 || value > 1) {
      throw new Error(
        `Ordinal map normalizer: mapped value for "${key}" (${value}) must be in [0, 1] range`
      );
    }
  }

  return {
    type: 'ordinal-map',
    map: args.map,
  };
}

/**
 * Create an identity normalizer specification
 *
 * Assumes values are already in [0, 1] range
 * For booleans: converts true -> 1, false -> 0
 *
 * @returns Identity normalizer spec
 */
export function createIdentityNormalizer<
  T extends MetricScalar = number,
  C = NormalizationContextFor<T>,
>(): NormalizerSpec<T, C> {
  return {
    type: 'identity',
  } as NormalizerSpec<T, C>;
}

/**
 * Create a custom normalizer specification
 *
 * Wraps a custom normalization function that transforms raw values to Scores
 * The function is responsible for ensuring the output is in [0, 1] range
 *
 * @param normalize - Custom normalization function
 * @returns Custom normalizer spec
 */
export function createCustomNormalizer<
  T extends MetricScalar = MetricScalar,
  C = NormalizationContextFor<T>,
>(args: {
  normalize: (value: T, args: { context: C; metric: MetricDef<T, MetricContainer> }) => Score;
}): NormalizerSpec<T, C> {
  return {
    type: 'custom',
    normalize: args.normalize as NormalizeToScore<T, C>,
  };
}
