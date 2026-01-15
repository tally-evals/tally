import { Aggregator, BaseMetricDef } from '@tally/core/types';
import { createPercentileAggregator } from './percentile';

/**
 * Default aggregators for single-turn metrics
 * Includes: mean, p50, p75, p90, p95, p99
 */
export const DEFAULT_AGGREGATORS = ({
  metric,
}: {
  metric: BaseMetricDef<number>;
}): Aggregator[] => [
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
