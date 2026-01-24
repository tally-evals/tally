/**
 * Distribution Aggregator
 *
 * Calculates the frequency distribution of categorical (string) values.
 * This is a categorical aggregator - works on string raw values only.
 */

import type { CategoricalAggregatorDef } from '@tally/core/types';

/**
 * Options for distribution aggregator
 */
export interface DistributionAggregatorOptions {
  /** Description of the aggregator */
  description?: string;
  /** Whether to return proportions (0-1) or counts. Default: true (proportions) */
  proportions?: boolean;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Create a distribution aggregator
 *
 * Calculates the frequency distribution of categorical values.
 * This aggregator is only compatible with string metrics.
 *
 * Returns a CategoricalAggregatorDef with literal name type 'Distribution'.
 *
 * @param options - Optional configuration
 * @returns CategoricalAggregatorDef<'Distribution'> that calculates value distribution
 *
 * @example
 * ```ts
 * // Returns proportions: { "A": 0.5, "B": 0.3, "C": 0.2 }
 * const distAgg = createDistributionAggregator({
 *   description: 'Distribution of quality grades'
 * });
 * // typeof distAgg.name is 'Distribution'
 *
 * // Returns counts: { "A": 5, "B": 3, "C": 2 }
 * const countAgg = createDistributionAggregator({
 *   proportions: false,
 * });
 * ```
 */
export function createDistributionAggregator(
  options?: DistributionAggregatorOptions
): CategoricalAggregatorDef<'Distribution'> {
  const proportions = options?.proportions ?? true;

  return {
    kind: 'categorical',
    name: 'Distribution',
    description:
      options?.description ??
      (proportions ? 'Frequency distribution (proportions)' : 'Frequency distribution (counts)'),
    aggregate: (values: readonly string[]) => {
      if (values.length === 0) {
        throw new Error('Distribution aggregator: cannot aggregate empty array');
      }

      const counts: Record<string, number> = {};
      for (const value of values) {
        counts[value] = (counts[value] ?? 0) + 1;
      }

      if (proportions) {
        const total = values.length;
        const result: Record<string, number> = {};
        for (const [key, count] of Object.entries(counts)) {
          result[key] = count / total;
        }
        return result;
      }

      return counts;
    },
    ...(options?.metadata !== undefined && { metadata: options.metadata }),
  };
}

/**
 * Create a mode aggregator
 *
 * Finds the most frequently occurring value(s) in a categorical array.
 * Returns a distribution with only the mode value(s) and their proportions.
 *
 * Returns a CategoricalAggregatorDef with literal name type 'Mode'.
 *
 * @param options - Optional configuration
 * @returns CategoricalAggregatorDef<'Mode'> that finds the mode(s)
 *
 * @example
 * ```ts
 * const modeAgg = createModeAggregator({
 *   description: 'Most common quality grade'
 * });
 * // typeof modeAgg.name is 'Mode'
 * ```
 */
export function createModeAggregator(
  options?: DistributionAggregatorOptions
): CategoricalAggregatorDef<'Mode'> {
  return {
    kind: 'categorical',
    name: 'Mode',
    description: options?.description ?? 'Most frequent value(s)',
    aggregate: (values: readonly string[]) => {
      if (values.length === 0) {
        throw new Error('Mode aggregator: cannot aggregate empty array');
      }

      const counts: Record<string, number> = {};
      let maxCount = 0;

      for (const value of values) {
        counts[value] = (counts[value] ?? 0) + 1;
        if (counts[value] > maxCount) {
          maxCount = counts[value];
        }
      }

      // Return only the mode value(s)
      const result: Record<string, number> = {};
      const total = values.length;
      for (const [key, count] of Object.entries(counts)) {
        if (count === maxCount) {
          result[key] = count / total;
        }
      }

      return result;
    },
    ...(options?.metadata !== undefined && { metadata: options.metadata }),
  };
}
