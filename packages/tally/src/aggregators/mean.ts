/**
 * Mean Aggregator
 *
 * Calculates the arithmetic mean (average) of numeric values across all data points.
 * This is a numeric aggregator - works on scores and numeric raw values.
 */

import { calculateMean, isEmpty } from '@tally/core/aggregators/base';
import type { NumericAggregatorDef } from '@tally/core/types';

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
 * @returns NumericAggregatorDef that calculates the mean of numeric values
 *
 * @example
 * ```ts
 * const meanAggregator = createMeanAggregator({
 *   description: 'Average quality score across all evaluations'
 * });
 * ```
 */
export function createMeanAggregator(options?: MeanAggregatorOptions): NumericAggregatorDef {
  return {
    kind: 'numeric',
    name: 'Mean',
    description: options?.description ?? 'Arithmetic mean',
    aggregate: (values: readonly number[]) => {
      if (isEmpty(values)) {
        throw new Error('Mean aggregator: cannot aggregate empty array');
      }
      return calculateMean(values);
    },
    ...(options?.metadata !== undefined && {
      metadata: options.metadata,
    }),
  };
}
