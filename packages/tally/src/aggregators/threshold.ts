/**
 * Threshold Aggregator
 *
 * Calculates the proportion of values that meet or exceed a threshold.
 * This is a numeric aggregator - works on scores and numeric raw values.
 *
 * ⚠️ DIFFERENT from verdict-based pass rates!
 * - This: counts values >= threshold (simple numeric comparison)
 * - VerdictSummary: counts verdicts based on verdict policy (can be complex)
 *
 * Use when you want a simple threshold check without verdict policies.
 */

import { calculatePassRate, isEmpty, validateScores } from '@tally/core/aggregators/base';
import type { NumericAggregatorDef, Score } from '@tally/core/types';

/**
 * Options for threshold aggregator
 */
export interface ThresholdAggregatorOptions {
  /** Threshold value (0-1). Values >= threshold are counted. Default: 0.5 */
  threshold?: number;
  /** Custom name for the aggregator. Default: "Threshold >= {threshold}" */
  name?: string;
  /** Description of the aggregator */
  description?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Create a threshold aggregator
 *
 * Counts the proportion of values that meet or exceed a threshold.
 * This is a simple numeric comparison, not a verdict policy evaluation.
 *
 * @param options - Optional configuration including threshold (default: 0.5)
 * @returns NumericAggregatorDef that calculates the proportion of values >= threshold
 *
 * @example
 * ```ts
 * // Default threshold (0.5)
 * const thresholdAgg = createThresholdAggregator();
 *
 * // Custom threshold (0.7 = 70%)
 * const strictThreshold = createThresholdAggregator({
 *   threshold: 0.7,
 *   description: 'Proportion of scores >= 70%'
 * });
 * ```
 */
export function createThresholdAggregator(
  options?: ThresholdAggregatorOptions
): NumericAggregatorDef {
  const threshold = options?.threshold ?? 0.5;

  if (threshold < 0 || threshold > 1) {
    throw new Error(`Threshold aggregator: threshold must be in [0, 1] range, got ${threshold}`);
  }

  return {
    kind: 'numeric',
    name: options?.name ?? `Threshold >= ${threshold}`,
    description: options?.description ?? `Proportion of values >= ${threshold}`,
    aggregate: (values: readonly number[]) => {
      if (isEmpty(values)) {
        throw new Error('Threshold aggregator: cannot aggregate empty array');
      }
      validateScores(values as readonly Score[]);
      return calculatePassRate(values as readonly Score[], threshold);
    },
    ...(options?.metadata !== undefined && { metadata: options.metadata }),
  };
}
