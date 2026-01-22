import type {
  AggregatorDef,
  CompatibleAggregator,
  MetricScalar,
  NumericAggregatorDef,
} from '@tally/core/types';
import { createDistributionAggregator } from './distribution';
import { createMeanAggregator } from './mean';
import { createPercentileAggregator } from './percentile';
import { createTrueRateAggregator } from './trueRate';

/**
 * Default numeric aggregators (for scores and numeric raw values)
 * Includes: mean, p50, p75, p90
 */
export const DEFAULT_NUMERIC_AGGREGATORS: NumericAggregatorDef[] = [
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

/**
 * @deprecated Use DEFAULT_NUMERIC_AGGREGATORS or getDefaultAggregators()
 */
export const DEFAULT_AGGREGATORS: AggregatorDef[] = DEFAULT_NUMERIC_AGGREGATORS;

/**
 * Get default aggregators compatible with a metric's value type
 *
 * @param valueType - The metric's value type ('number' | 'boolean' | 'string' | 'ordinal')
 * @returns Array of compatible aggregators:
 *   - number: Only numeric aggregators (scores are numbers, raw values are numbers)
 *   - boolean: Numeric (for scores) + Boolean (TrueRate for raw values)
 *   - string/ordinal: Numeric (for scores) + Categorical (Distribution for raw values)
 */
export function getDefaultAggregators<T extends MetricScalar>(
  valueType: 'number' | 'boolean' | 'string' | 'ordinal'
): CompatibleAggregator<T>[] {
  switch (valueType) {
    case 'number':
      return [...DEFAULT_NUMERIC_AGGREGATORS] as CompatibleAggregator<T>[];
    case 'boolean':
      return [
        ...DEFAULT_NUMERIC_AGGREGATORS,
        createTrueRateAggregator({
          description: 'Rate of true values in raw results',
        }),
      ] as CompatibleAggregator<T>[];
    case 'string':
    case 'ordinal':
      return [
        ...DEFAULT_NUMERIC_AGGREGATORS,
        createDistributionAggregator({
          description: 'Distribution of categorical values',
        }),
      ] as CompatibleAggregator<T>[];
    default:
      return [...DEFAULT_NUMERIC_AGGREGATORS] as CompatibleAggregator<T>[];
  }
}
