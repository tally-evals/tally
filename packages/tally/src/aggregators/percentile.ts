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
 * Options for percentile aggregator with typed percentile value.
 *
 * @typeParam TPercentile - Literal number type for the percentile value
 */
export interface PercentileAggregatorOptions<TPercentile extends number = number> {
  percentile: TPercentile; // 0-100
  description?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Create a percentile aggregator
 *
 * Uses `const` type parameter to preserve literal percentile value,
 * enabling type-safe access like `P50`, `P95`, etc.
 *
 * @typeParam TPercentile - Literal number type for the percentile value
 * @param options - Configuration including percentile value (0-100)
 * @returns NumericAggregatorDef with name `P${percentile}`
 *
 * @example
 * ```ts
 * // Calculate 95th percentile
 * const p95Aggregator = createPercentileAggregator({
 *   percentile: 95,
 *   description: '95th percentile latency'
 * });
 * // typeof p95Aggregator.name is 'P95'
 * ```
 */
export function createPercentileAggregator<const TPercentile extends number>(
  options: PercentileAggregatorOptions<TPercentile>
): NumericAggregatorDef<`P${TPercentile}`> {
  const { percentile } = options;

  if (percentile < 0 || percentile > 100) {
    throw new Error(
      `Percentile aggregator: percentile must be in [0, 100] range, got ${percentile}`
    );
  }

  return {
    kind: 'numeric',
    name: `P${percentile}` as `P${TPercentile}`,
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
