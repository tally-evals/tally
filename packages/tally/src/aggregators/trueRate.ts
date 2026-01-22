/**
 * True Rate Aggregator
 *
 * Calculates the proportion of true values in a boolean array.
 * This is a boolean aggregator - works on boolean raw values only.
 */

import type { BooleanAggregatorDef } from '@tally/core/types';

/**
 * Options for true rate aggregator
 */
export interface TrueRateAggregatorOptions {
  /** Custom name for the aggregator. Default: "TrueRate" */
  name?: string;
  /** Description of the aggregator */
  description?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Create a true rate aggregator
 *
 * Calculates the proportion of true values in a boolean array.
 * This aggregator is only compatible with boolean metrics.
 *
 * @param options - Optional configuration
 * @returns BooleanAggregatorDef that calculates the proportion of true values
 *
 * @example
 * ```ts
 * const trueRateAgg = createTrueRateAggregator({
 *   description: 'Rate of successful validations'
 * });
 * ```
 */
export function createTrueRateAggregator(
  options?: TrueRateAggregatorOptions
): BooleanAggregatorDef {
  return {
    kind: 'boolean',
    name: options?.name ?? 'TrueRate',
    description: options?.description ?? 'Proportion of true values',
    aggregate: (values: readonly boolean[]) => {
      if (values.length === 0) {
        throw new Error('TrueRate aggregator: cannot aggregate empty array');
      }
      const trueCount = values.filter((v) => v === true).length;
      return trueCount / values.length;
    },
    ...(options?.metadata !== undefined && { metadata: options.metadata }),
  };
}

/**
 * Create a false rate aggregator
 *
 * Calculates the proportion of false values in a boolean array.
 * This aggregator is only compatible with boolean metrics.
 *
 * @param options - Optional configuration
 * @returns BooleanAggregatorDef that calculates the proportion of false values
 *
 * @example
 * ```ts
 * const falseRateAgg = createFalseRateAggregator({
 *   description: 'Rate of failed validations'
 * });
 * ```
 */
export function createFalseRateAggregator(
  options?: TrueRateAggregatorOptions
): BooleanAggregatorDef {
  return {
    kind: 'boolean',
    name: options?.name ?? 'FalseRate',
    description: options?.description ?? 'Proportion of false values',
    aggregate: (values: readonly boolean[]) => {
      if (values.length === 0) {
        throw new Error('FalseRate aggregator: cannot aggregate empty array');
      }
      const falseCount = values.filter((v) => v === false).length;
      return falseCount / values.length;
    },
    ...(options?.metadata !== undefined && { metadata: options.metadata }),
  };
}
