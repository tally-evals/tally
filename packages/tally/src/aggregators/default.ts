import { AggregatorDef } from '@tally/core/types';
import { createPercentileAggregator } from './percentile';
import { createMeanAggregator } from './mean';

/**
 * Default aggregators for single-turn metrics
 * Includes: mean, p50, p75, p90, p95, p99
 */
export const DEFAULT_AGGREGATORS: AggregatorDef[] = [
  createMeanAggregator({
    description: 'Mean of the metric',
  }),
  createPercentileAggregator({
    percentile: 50,
    description: '50th percentile of the metric',
  }),
  createPercentileAggregator({
    percentile: 75,
    description: '75th percentile of the metric',
  }),
  createPercentileAggregator({
    percentile: 90,
    description: '90th percentile of the metric',
  }),
];
