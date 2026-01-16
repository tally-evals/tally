/**
 * Context resolution utilities
 *
 * Resolves static vs dynamic normalization contexts
 * Computes distribution statistics when needed
 * Caches resolved contexts per metric
 */

import type { MetricNormalization, MetricScalar, ScoringContext } from '@tally/core/types';

/**
 * Cache for resolved contexts
 * Key: metric name, Value: resolved context
 */
const contextCache = new Map<string, ScoringContext>();

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
 * Resolve normalization context
 *
 * Handles both static contexts and dynamic context resolvers
 * Caches resolved contexts per metric to avoid recomputation
 *
 * @param normalization - Metric normalization configuration
 * @param dataset - Full dataset for context resolution
 * @param rawValues - Raw metric values for this metric
 * @param metricName - Name of the metric (for caching)
 * @returns Resolved ScoringContext
 */
export async function resolveContext<T extends MetricScalar>(
  normalization: MetricNormalization<T, ScoringContext> | undefined,
  dataset: readonly unknown[],
  rawValues: readonly T[],
  metricName: string
): Promise<ScoringContext> {
  // Check cache first
  const cached = contextCache.get(metricName);
  if (cached) {
    return cached;
  }

  // If no normalization config, return empty context
  if (!normalization || !normalization.context) {
    const emptyContext: ScoringContext = {};
    contextCache.set(metricName, emptyContext);
    return emptyContext;
  }

  const { context } = normalization;

  // Handle static context
  if (typeof context !== 'function') {
    contextCache.set(metricName, context);
    return context;
  }

  // Handle dynamic context resolver
  const resolvedContext = await context({ dataset, rawValues });
  contextCache.set(metricName, resolvedContext);
  return resolvedContext;
}

/**
 * Clear the context cache
 * Useful for testing or when dataset changes
 */
export function clearContextCache(): void {
  contextCache.clear();
}

/**
 * Get cached context for a metric
 * Returns undefined if not cached
 */
export function getCachedContext(metricName: string): ScoringContext | undefined {
  return contextCache.get(metricName);
}
