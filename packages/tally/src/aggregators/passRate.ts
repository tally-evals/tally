/**
 * Pass Rate Aggregator
 *
 * Calculates the pass rate (percentage of values >= threshold) from Score values
 * across all data points. Useful for binary classification metrics.
 */

import type { Aggregator, BaseMetricDef, Score } from '@tally/core/types';
import {
  validateScores,
  isEmpty,
  calculatePassRate,
} from '@tally/core/aggregators/base';

/**
 * Options for pass rate aggregator
 */
export interface PassRateAggregatorOptions {
  threshold?: number; // Default: 0.5
  description?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Create a pass rate aggregator
 *
 * @param metric - Base metric definition for the derived metric being aggregated
 * @param options - Optional configuration including pass threshold (default: 0.5)
 * @returns Aggregator that calculates the pass rate of Score values
 *
 * @example
 * ```ts
 * // Pass rate with default 0.5 threshold
 * const passRateAggregator = createPassRateAggregator(qualityMetric);
 *
 * // Pass rate with custom threshold (0.7 = 70%)
 * const strictPassRate = createPassRateAggregator(qualityMetric, {
 *   threshold: 0.7,
 *   description: 'Pass rate at 70% threshold'
 * });
 * ```
 */
export function createPassRateAggregator(
  metric: BaseMetricDef<number>,
  options?: PassRateAggregatorOptions,
): Aggregator {
  const threshold = options?.threshold ?? 0.5;

  if (threshold < 0 || threshold > 1) {
    throw new Error(
      `Pass rate aggregator for ${metric.name}: threshold must be in [0, 1] range, got ${threshold}`,
    );
  }

  return {
    name: `Pass Rate`,
    description:
      options?.description ??
      `Pass rate of ${metric.name} (threshold: ${threshold})`,
    metric,
    aggregate: (values: readonly Score[]) => {
      if (isEmpty(values)) {
        throw new Error(
          `Pass rate aggregator for ${metric.name}: cannot aggregate empty array`,
        );
      }

      validateScores(values);
      return calculatePassRate(values, threshold);
    },
    ...(options?.metadata !== undefined && { metadata: options.metadata }),
  };
}
