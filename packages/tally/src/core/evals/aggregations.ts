/**
 * Verdict Summary Utilities
 *
 * Calculates verdict summaries (pass/fail rates) from eval verdict policies.
 * These are SEPARATE from statistical aggregations (mean, percentiles, etc.).
 *
 * Statistical aggregations come from metric.aggregators[].
 * Verdict summaries come from eval.verdict policies.
 */

import type { MetricScalar, Score } from '@tally/core/types';
import { toScore } from '@tally/core/types';
import type { VerdictPolicy } from './types';
import { computeVerdict } from './verdict';

/**
 * Calculate verdict summary from scores and verdict policy
 *
 * This function computes pass/fail/unknown rates based on the eval's verdict policy.
 * It is NOT the same as statistical aggregations (mean, percentiles, etc.).
 *
 * @param scores - Normalized scores (0-1)
 * @param verdictPolicy - The verdict policy from the eval
 * @param rawValues - Optional raw values for verdict computation
 * @returns VerdictSummary with pass/fail rates and counts
 */
export function calculateVerdictSummary(
  scores: readonly Score[],
  verdictPolicy: VerdictPolicy,
  rawValues?: readonly MetricScalar[]
): import('@tally-evals/core').VerdictSummary {
  if (scores.length === 0) {
    throw new Error('Cannot calculate verdict summary for empty scores array');
  }

  if (verdictPolicy.kind === 'none') {
    // No verdict policy - all unknown
    return {
      passRate: toScore(0),
      failRate: toScore(0),
      unknownRate: toScore(1),
      passCount: 0,
      failCount: 0,
      unknownCount: scores.length,
      totalCount: scores.length,
    };
  }

  // Compute verdicts for each score
  const verdicts = scores.map((score, index) => {
    const rawValue = rawValues?.[index];
    if (rawValue === undefined) {
      return 'unknown';
    }
    return computeVerdict(score, rawValue, verdictPolicy);
  });

  const passCount = verdicts.filter((v) => v === 'pass').length;
  const failCount = verdicts.filter((v) => v === 'fail').length;
  const unknownCount = verdicts.filter((v) => v === 'unknown').length;
  const totalCount = scores.length;

  return {
    passRate: toScore(passCount / totalCount),
    failRate: toScore(failCount / totalCount),
    unknownRate: toScore(unknownCount / totalCount),
    passCount,
    failCount,
    unknownCount,
    totalCount,
  };
}

/**
 * Calculate pass rate from scores and verdict policy
 *
 * Convenience function that returns just the pass rate.
 *
 * @param scores - Normalized scores (0-1)
 * @param verdictPolicy - The verdict policy from the eval
 * @param rawValues - Optional raw values for verdict computation
 * @returns Pass rate as a Score (0-1)
 */
export function calculateVerdictPassRate(
  scores: readonly Score[],
  verdictPolicy: VerdictPolicy,
  rawValues?: readonly MetricScalar[]
): Score {
  const summary = calculateVerdictSummary(scores, verdictPolicy, rawValues);
  return summary.passRate;
}

/**
 * Calculate distribution of ordinal/categorical values
 *
 * This is useful for string/ordinal metrics to see the breakdown of values.
 *
 * @param rawValues - Array of raw values (typically strings)
 * @returns Record mapping each unique value to its count
 */
export function calculateDistribution(rawValues: readonly MetricScalar[]): Record<string, number> {
  const distribution: Record<string, number> = {};
  for (const value of rawValues) {
    const key = String(value);
    distribution[key] = (distribution[key] ?? 0) + 1;
  }
  return distribution;
}
