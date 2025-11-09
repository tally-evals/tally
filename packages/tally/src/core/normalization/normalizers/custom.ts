/**
 * Custom normalizer wrapper
 * 
 * Wraps a custom normalization function
 * The function is responsible for ensuring the output is in [0, 1] range
 */

import type { Score, MetricScalar, MetricDef, NormalizeToScore } from '@tally/core/types';
import { toScore } from '@tally/core/types';

/**
 * Apply custom normalization
 */
export function normalizeCustom<T extends MetricScalar, C = unknown>(
	value: T,
	normalizeFn: NormalizeToScore<T, C>,
	context: C,
	metric: MetricDef<T, unknown>
): Score {
	const result = normalizeFn(value, { context, metric });

	// Validate the result is a valid Score
	if (typeof result !== 'number' || result < 0 || result > 1) {
		throw new Error(
			`Custom normalizer returned invalid Score: ${result}. Score must be a number in [0, 1] range.`
		);
	}

	return toScore(result);
}

