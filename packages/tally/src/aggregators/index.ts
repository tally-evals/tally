/**
 * Prebuilt Aggregators
 *
 * Ready-to-use aggregator implementations for summarizing evaluation results.
 */

import type { Aggregator, BaseMetricDef } from '@tally/core/types';
import { createMeanAggregator } from './mean';
import { createPercentileAggregator } from './percentile';

export { createMeanAggregator } from './mean';
export { createPercentileAggregator } from './percentile';
export { createPassRateAggregator } from './passRate';

// Export option types
export type { MeanAggregatorOptions } from './mean';
export type { PercentileAggregatorOptions } from './percentile';
export type { PassRateAggregatorOptions } from './passRate';

/**
 * Default aggregators for single-turn metrics
 * Includes: mean, p50, p75, p90, p95, p99
 */
export const DEFAULT_AGGREGATORS = ({
  metric,
}: {
  metric: BaseMetricDef<number>;
}): Aggregator[] => [
  createMeanAggregator({
    metric,
    options: {
      description: 'Mean of the metric',
    },
  }),
  createPercentileAggregator(metric, {
    percentile: 50,
    description: '50th percentile of the metric',
  }),
  createPercentileAggregator(metric, {
    percentile: 75,
    description: '75th percentile of the metric',
  }),
  createPercentileAggregator(metric, {
    percentile: 90,
    description: '90th percentile of the metric',
  }),
];
