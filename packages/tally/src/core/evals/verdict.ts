/**
 * Verdict Computation
 *
 * Type-safe verdict computation based on verdict policies
 */

import type { MetricScalar, Score } from '@tally/core/types';
import type { VerdictPolicy } from './types';

/**
 * Compute verdict (pass/fail) based on score, raw value, and policy
 */
export function computeVerdict(
  score: Score,
  rawValue: MetricScalar,
  policy: VerdictPolicy
): 'pass' | 'fail' | 'unknown' {
  if (policy.kind === 'none') {
    return 'unknown';
  }

  if (policy.kind === 'boolean') {
    const boolValue = rawValue as boolean;
    return boolValue === policy.passWhen ? 'pass' : 'fail';
  }

  if (policy.kind === 'number') {
    if (policy.type === 'threshold') {
      if (typeof rawValue !== 'number') {
        throw new Error('Raw value must be a number with threshold verdict policy');
      } else {
        return rawValue >= policy.passAt ? 'pass' : 'fail';
      }
    }
    if (policy.type === 'range') {
      const min = policy.min ?? 0;
      const max = policy.max ?? 1;

      if (typeof rawValue !== 'number') {
        throw new Error('Raw value must be a number with range verdict policy');
      } else {
        return rawValue >= min && rawValue <= max ? 'pass' : 'fail';
      }
    }
  }

  if (policy.kind === 'ordinal') {
    const stringValue = rawValue as string;
    return policy.passWhenIn.includes(stringValue) ? 'pass' : 'fail';
  }

  if (policy.kind === 'custom') {
    return policy.verdict(score, rawValue);
  }

  return 'unknown';
}
