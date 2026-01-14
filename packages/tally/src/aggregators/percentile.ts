/**
 * Percentile Aggregator
 *
 * Calculates a specific percentile value from Score values across all data points.
 * Uses linear interpolation for percentile calculation.
 */

import type { Aggregator, BaseMetricDef, Score } from '@tally/core/types';
import {
  validateScores,
  isEmpty,
  sortScores,
  calculatePercentile,
} from '@tally/core/aggregators/base';

/**
 * Options for percentile aggregator
 */
export interface PercentileAggregatorOptions {
  percentile: number; // 0-100
  description?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Create a percentile aggregator
 *
 * @param metric - Base metric definition for the derived metric being aggregated
 * @param options - Configuration including percentile value (0-100)
 * @returns Aggregator that calculates the specified percentile of Score values
 *
 * @example
 * ```ts
 * // Calculate 95th percentile
 * const p95Aggregator = createPercentileAggregator(latencyMetric, {
 *   percentile: 95,
 *   description: '95th percentile latency'
 * });
 * ```
 */
export function createPercentileAggregator(
  metric: BaseMetricDef<number>,
  options: PercentileAggregatorOptions,
): Aggregator {
  const { percentile } = options;

  if (percentile < 0 || percentile > 100) {
    throw new Error(
      `Percentile aggregator for ${metric.name}: percentile must be in [0, 100] range, got ${percentile}`,
    );
  }

  return {
    name: `P${percentile}`,
    description:
      options.description ?? `${percentile}th percentile of ${metric.name}`,
    metric,
    aggregate: (values: readonly Score[]) => {
      if (isEmpty(values)) {
        throw new Error(
          `Percentile aggregator for ${metric.name}: cannot aggregate empty array`,
        );
      }

      validateScores(values);
      const sorted = sortScores(values);
      return calculatePercentile(sorted, percentile);
    },
    ...(options.metadata !== undefined && { metadata: options.metadata }),
  };
}
