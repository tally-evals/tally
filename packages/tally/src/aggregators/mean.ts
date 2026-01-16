/**
 * Mean Aggregator
 *
 * Calculates the arithmetic mean (average) of Score values across all data points.
 */

import type { AggregatorDef } from '@tally/core/types';
import { isEmpty, calculateMean } from '@tally/core/aggregators/base';

/**
 * Options for mean aggregator
 */
export interface MeanAggregatorOptions {
  description?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Create a mean aggregator
 *
 * @param options - Optional configuration
 * @returns Aggregator that calculates the mean of Score values
 *
 * @example
 * ```ts
 * const meanAggregator = createMeanAggregator({
 *   description: 'Average quality score across all evaluations'
 * });
 * ```
 */
export function createMeanAggregator(
  options?: MeanAggregatorOptions,
): AggregatorDef {
  return {
    name: `Mean`,
    description: options?.description ?? `Mean`,
    aggregate: (values: readonly number[]) => {
      if (isEmpty(values)) {
        throw new Error(`Mean aggregator: cannot aggregate empty array`);
      }

      return calculateMean(values);
    },
    ...(options?.metadata !== undefined && {
      metadata: options.metadata,
    }),
  };
}
