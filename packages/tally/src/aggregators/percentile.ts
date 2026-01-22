/**
 * Percentile Aggregator
 *
 * Calculates a specific percentile value from numeric values across all data points.
 * Uses linear interpolation for percentile calculation.
 * This is a numeric aggregator - works on scores and numeric raw values.
 */

import { calculatePercentile, isEmpty, sortNumbers } from '@tally/core/aggregators/base';
import type { NumericAggregatorDef } from '@tally/core/types';

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
 * @returns NumericAggregatorDef that calculates the specified percentile
 *
 * @example
 * ```ts
 * // Calculate 95th percentile
 * const p95Aggregator = createPercentileAggregator({
 *   percentile: 95,
 *   description: '95th percentile latency'
 * });
 * ```
 */
export function createPercentileAggregator(
  options: PercentileAggregatorOptions
): NumericAggregatorDef {
  const { percentile } = options;

  if (percentile < 0 || percentile > 100) {
    throw new Error(
      `Percentile aggregator: percentile must be in [0, 100] range, got ${percentile}`
    );
  }

  return {
    kind: 'numeric',
    name: `P${percentile}`,
    description: options.description ?? `${percentile}th percentile`,
    aggregate: (values: readonly number[]) => {
      if (isEmpty(values)) {
        throw new Error('Percentile aggregator: cannot aggregate empty array');
      }
      const sorted = sortNumbers(values);
      return calculatePercentile(sorted, percentile);
    },
    ...(options.metadata !== undefined && { metadata: options.metadata }),
  };
}
