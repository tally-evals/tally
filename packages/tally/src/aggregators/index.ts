/**
 * Prebuilt Aggregators
 *
 * Ready-to-use aggregator implementations for summarizing evaluation results.
 */

export { createMeanAggregator } from './mean';
export { createPercentileAggregator } from './percentile';
export { createPassRateAggregator } from './passRate';

// Export option types
export type { MeanAggregatorOptions } from './mean';
export type { PercentileAggregatorOptions } from './percentile';
export type { PassRateAggregatorOptions } from './passRate';
