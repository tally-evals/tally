/**
 * Built-in Aggregation Utilities
 *
 * Calculates built-in aggregations (mean, percentiles, pass/fail rates)
 * for eval results. These are always computed automatically.
 */

import type { Score, MetricScalar } from '@tally/core/types';
import type { BuiltInAggregations } from '@tally/core/types';
import type { VerdictPolicy } from './types';
import { toScore } from '@tally/core/types';
import { computeVerdict } from './verdict';

/**
 * Calculate built-in aggregations (pass/fail rates and distribution)
 * Custom aggregates are computed separately in the pipeline
 */
export function calculateBuiltInAggregations(
  scores: readonly Score[],
  rawValues?: readonly MetricScalar[],
  verdictPolicy?: VerdictPolicy,
): BuiltInAggregations {
  if (scores.length === 0) {
    throw new Error('Cannot calculate aggregations for empty scores array');
  }

  const aggregations: BuiltInAggregations = {};

  // Calculate pass/fail rates if verdict policy exists
  if (verdictPolicy && verdictPolicy.kind !== 'none') {
    const verdicts = scores.map((score, index) => {
      const rawValue = rawValues?.[index];
      if (rawValue === undefined) {
        return 'unknown';
      }
      return computeVerdict(score, rawValue, verdictPolicy);
    });

    const passCount = verdicts.filter((v) => v === 'pass').length;
    const failCount = verdicts.filter((v) => v === 'fail').length;
    const totalCount = scores.length;

    aggregations.passRate = toScore(passCount / totalCount);
    aggregations.failRate = toScore(failCount / totalCount);
    aggregations.passCount = passCount;
    aggregations.failCount = failCount;
  }

  // Calculate distribution for ordinal metrics
  if (rawValues && rawValues.length > 0) {
    const firstValue = rawValues[0];
    if (typeof firstValue === 'string') {
      // Check if this looks like ordinal data
      const distribution: Record<string, number> = {};
      for (const value of rawValues) {
        if (typeof value === 'string') {
          distribution[value] = (distribution[value] ?? 0) + 1;
        }
      }
      if (Object.keys(distribution).length > 0) {
        aggregations.distribution = distribution;
      }
    }
  }

  return aggregations;
}

/**
 * Calculate pass rate from scores and verdict policy
 */
export function calculatePassRate(
  scores: readonly Score[],
  verdictPolicy: VerdictPolicy,
  rawValues?: readonly MetricScalar[],
): Score {
  if (scores.length === 0) {
    throw new Error('Cannot calculate pass rate for empty scores array');
  }

  if (verdictPolicy.kind === 'none') {
    throw new Error('Cannot calculate pass rate without verdict policy');
  }

  const { computeVerdict } = require('./verdict');
  const verdicts = scores.map((score, index) => {
    const rawValue = rawValues?.[index];
    if (rawValue === undefined) {
      return 'unknown';
    }
    return computeVerdict(score, rawValue, verdictPolicy);
  });

  const passCount = verdicts.filter((v) => v === 'pass').length;
  return toScore(passCount / scores.length);
}

/**
 * Calculate distribution of ordinal values
 */
export function calculateDistribution(
  rawValues: readonly MetricScalar[],
): Record<string, number> {
  const distribution: Record<string, number> = {};
  for (const value of rawValues) {
    const key = String(value);
    distribution[key] = (distribution[key] ?? 0) + 1;
  }
  return distribution;
}
