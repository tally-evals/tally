/**
 * Verdict Policy Helper Functions
 *
 * Convenience functions for creating verdict policies
 */

import type { Score, MetricScalar } from '@tally/core/types';
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
	if (passAt < 0 || passAt > 1) {
		throw new Error(`Threshold must be in [0, 1] range, got ${passAt}`);
	}
	return { kind: 'number', type: 'threshold', passAt };
}

/**
 * Create a range verdict policy (pass when score is in range)
 */
export function rangeVerdict(min?: number, max?: number): VerdictPolicyFor<number> {
	if (min !== undefined && (min < 0 || min > 1)) {
		throw new Error(`Min must be in [0, 1] range, got ${min}`);
	}
	if (max !== undefined && (max < 0 || max > 1)) {
		throw new Error(`Max must be in [0, 1] range, got ${max}`);
	}
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

