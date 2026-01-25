/**
 * Verdict Policy Helper Functions
 *
 * Convenience functions for creating verdict policies
 */

import type { MetricScalar, Score } from '../core/types';
import type { VerdictPolicyFor } from '../core/evals/types';

/**
 * Create a boolean verdict policy
 */
export function booleanVerdict(passWhen: true | false): VerdictPolicyFor<boolean> {
  return { kind: 'boolean', passWhen };
}

/**
 * Create a threshold verdict policy (pass when score >= threshold)
 */
export function thresholdVerdict(passAt: number): VerdictPolicyFor<number> {
  return { kind: 'number', type: 'threshold', passAt };
}

/**
 * Create a range verdict policy (pass when score is in range)
 */
export function rangeVerdict(min?: number, max?: number): VerdictPolicyFor<number> {
  return {
    kind: 'number',
    type: 'range',
    ...(min !== undefined ? { min } : {}),
    ...(max !== undefined ? { max } : {}),
  };
}

/**
 * Create an ordinal verdict policy (pass when value is in allowed list)
 */
export function ordinalVerdict(passWhenIn: readonly string[]): VerdictPolicyFor<string> {
  if (passWhenIn.length === 0) {
    throw new Error('ordinalVerdict: passWhenIn array cannot be empty');
  }
  return { kind: 'ordinal', passWhenIn };
}

/**
 * Create a custom verdict policy
 */
export function customVerdict<T extends MetricScalar>(
  fn: (score: Score, rawValue: T) => 'pass' | 'fail' | 'unknown'
): VerdictPolicyFor<T> {
  return {
    kind: 'custom',
    verdict: fn,
  } as VerdictPolicyFor<T>;
}
