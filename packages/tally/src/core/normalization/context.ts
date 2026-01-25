/**
 * Calibration resolution utilities
 *
 * Resolves static vs dynamic metric calibration contexts.
 *
 * NOTE: Caching is intentionally scoped to a single run invocation. Do not
 * use a module-global cache keyed only by metric name, as that can leak
 * calibration between different datasets within the same process.
 */

import type {
  MetricNormalization,
  MetricScalar,
  NormalizationContextFor,
} from '@tally/core/types';

export type CalibrationCache = Map<string, unknown>;

/**
 * Compute distribution statistics (mean, stdDev) from raw values
 */
export function computeDistributionStats(rawValues: readonly number[]): {
  mean: number;
  stdDev: number;
} {
  if (rawValues.length === 0) {
    throw new Error('Cannot compute distribution stats from empty array');
  }

  const mean = rawValues.reduce((sum, val) => sum + val, 0) / rawValues.length;

  const variance = rawValues.reduce((sum, val) => sum + (val - mean) ** 2, 0) / rawValues.length;
  const stdDev = Math.sqrt(variance);

  return { mean, stdDev };
}

/**
 * Compute min/max range from raw values
 */
export function computeRange(rawValues: readonly number[]): { min: number; max: number } {
  if (rawValues.length === 0) {
    throw new Error('Cannot compute range from empty array');
  }

  const firstValue = rawValues[0];
  if (firstValue === undefined) {
    throw new Error('Cannot compute range from empty array');
  }

  let min = firstValue;
  let max = firstValue;

  for (const value of rawValues) {
    if (value < min) {
      min = value;
    }
    if (value > max) {
      max = value;
    }
  }

  return { min, max };
}

/**
 * Resolve metric calibration context
 *
 * Handles both static calibration objects and dynamic calibration resolvers.
 *
 * @param normalization - Metric normalization configuration
 * @param dataset - Full dataset for calibration resolution
 * @param rawValues - Raw metric values for this metric
 * @param metricName - Name of the metric (for per-run caching)
 * @param cache - Per-run cache
 * @returns Resolved calibration context
 */
export async function resolveCalibration<T extends MetricScalar>(
  normalization: MetricNormalization<T, NormalizationContextFor<T>> | undefined,
  dataset: readonly unknown[],
  rawValues: readonly T[],
  metricName: string,
  cache: CalibrationCache
): Promise<NormalizationContextFor<T>> {
  const cached = cache.get(metricName) as NormalizationContextFor<T> | undefined;
  if (cached) return cached;

  // If no normalization config, or no calibrate, return empty calibration object
  if (!normalization || !normalization.calibrate) {
    const empty = {} as NormalizationContextFor<T>;
    cache.set(metricName, empty);
    return empty;
  }

  const { calibrate } = normalization;

  // Static calibration object
  if (typeof calibrate !== 'function') {
    cache.set(metricName, calibrate);
    return calibrate;
  }

  // Dynamic calibration resolver
  const resolved = await calibrate({ dataset, rawValues });
  cache.set(metricName, resolved);
  return resolved;
}

export function createCalibrationCache(): CalibrationCache {
  return new Map();
}
