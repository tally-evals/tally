/**
 * Percentile Aggregator
 *
 * Calculates a specific percentile value from Score values across all data points.
 * Uses linear interpolation for percentile calculation.
 */

import type { AggregatorDef, Score } from '@tally/core/types';
import {
  isEmpty,
  calculatePercentile,
  sortNumbers,
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
  options: PercentileAggregatorOptions,
): AggregatorDef {
  const { percentile } = options;

  if (percentile < 0 || percentile > 100) {
    throw new Error(
      `Percentile aggregator: percentile must be in [0, 100] range, got ${percentile}`,
    );
  }

  return {
    name: `P${percentile}`,
    description: options.description ?? `${percentile}th percentile`,
    aggregate: (values: readonly number[]) => {
      if (isEmpty(values as readonly Score[])) {
        throw new Error(`Percentile aggregator: cannot aggregate empty array`);
      }
      const sorted = sortNumbers(values);
      return calculatePercentile(sorted, percentile);
    },
    ...(options.metadata !== undefined && { metadata: options.metadata }),
  };
}
