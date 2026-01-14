/**
 * Mean Aggregator
 *
 * Calculates the arithmetic mean (average) of Score values across all data points.
 */

import type { Aggregator, BaseMetricDef, Score } from '@tally/core/types';
import {
  validateScores,
  isEmpty,
  calculateMean,
} from '@tally/core/aggregators/base';

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
 * @param metric - Base metric definition for the derived metric being aggregated
 * @param options - Optional configuration
 * @returns Aggregator that calculates the mean of Score values
 *
 * @example
 * ```ts
 * const meanAggregator = createMeanAggregator(qualityMetric, {
 *   description: 'Average quality score across all evaluations'
 * });
 * ```
 */
export function createMeanAggregator(args: {
  metric: BaseMetricDef<number>;
  options?: MeanAggregatorOptions;
}): Aggregator {
  return {
    name: `Mean`,
    description: args.options?.description ?? `Mean of ${args.metric.name}`,
    metric: args.metric,
    aggregate: (values: readonly Score[]) => {
      if (isEmpty(values)) {
        throw new Error(
          `Mean aggregator for ${args.metric.name}: cannot aggregate empty array`,
        );
      }

      validateScores(values);
      return calculateMean(values);
    },
    ...(args.options?.metadata !== undefined && {
      metadata: args.options.metadata,
    }),
  };
}
