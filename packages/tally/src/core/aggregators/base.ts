/**
 * Base Aggregation Utilities
 *
 * Common utilities for aggregators including Score validation,
 * statistical operations, and edge case handling.
 */

import type { Score } from '@tally/core/types';
import { toScore } from '@tally/core/types';

/**
 * Validate that all values in a Score array are within [0, 1] range
 *
 * @param values - Array of Score values to validate
 * @throws Error if any value is outside [0, 1] range
 */
export function validateScores(values: readonly Score[]): void {
	for (let i = 0; i < values.length; i++) {
		const value = values[i];
		if (typeof value !== 'number' || Number.isNaN(value) || !Number.isFinite(value)) {
			throw new Error(
				`Invalid Score at index ${i}: must be a finite number, got ${value}`
			);
		}
		if (value < 0 || value > 1) {
			throw new Error(
				`Invalid Score at index ${i}: must be in [0, 1] range, got ${value}`
			);
		}
	}
}

/**
 * Check if a Score array is empty
 *
 * @param values - Array of Score values
 * @returns True if array is empty
 */
export function isEmpty(values: readonly Score[]): boolean {
	return values.length === 0;
}

/**
 * Calculate the mean (average) of Score values
 *
 * @param values - Array of Score values
 * @returns Mean Score value
 */
export function calculateMean(values: readonly Score[]): Score {
	if (values.length === 0) {
		throw new Error('Cannot calculate mean of empty array');
	}

	const sum = values.reduce((acc, val) => acc + val, 0);
	return toScore(sum / values.length);
}

/**
 * Sort Score values in ascending order
 * Returns a new array without mutating the input
 *
 * @param values - Array of Score values
 * @returns Sorted array of Score values
 */
export function sortScores(values: readonly Score[]): Score[] {
	return [...values].sort((a, b) => a - b);
}

/**
 * Calculate percentile value from sorted Score array
 *
 * @param sortedValues - Sorted array of Score values (ascending)
 * @param percentile - Percentile value (0-100)
 * @returns Score value at the specified percentile
 */
export function calculatePercentile(sortedValues: readonly Score[], percentile: number): Score {
	if (sortedValues.length === 0) {
		throw new Error('Cannot calculate percentile of empty array');
	}

	if (percentile < 0 || percentile > 100) {
		throw new Error(`Percentile must be in [0, 100] range, got ${percentile}`);
	}

	if (percentile === 0) {
		const first = sortedValues[0];
		if (first === undefined) {
			throw new Error('Cannot access first element of empty array');
		}
		return first;
	}

	if (percentile === 100) {
		const last = sortedValues[sortedValues.length - 1];
		if (last === undefined) {
			throw new Error('Cannot access last element of empty array');
		}
		return last;
	}

	// Linear interpolation method
	const index = (percentile / 100) * (sortedValues.length - 1);
	const lowerIndex = Math.floor(index);
	const upperIndex = Math.ceil(index);
	const weight = index - lowerIndex;

	if (lowerIndex === upperIndex) {
		const value = sortedValues[lowerIndex];
		if (value === undefined) {
			throw new Error(`Cannot access element at index ${lowerIndex}`);
		}
		return value;
	}

	const lowerValue = sortedValues[lowerIndex];
	const upperValue = sortedValues[upperIndex];
	if (lowerValue === undefined || upperValue === undefined) {
		throw new Error(
			`Cannot access elements at indices ${lowerIndex} or ${upperIndex}`
		);
	}
	const interpolated = lowerValue + weight * (upperValue - lowerValue);

	return toScore(interpolated);
}

/**
 * Count values that meet a threshold condition
 *
 * @param values - Array of Score values
 * @param threshold - Threshold value (0-1)
 * @param above - If true, count values >= threshold; if false, count values < threshold
 * @returns Count of values meeting the condition
 */
export function countThreshold(
	values: readonly Score[],
	threshold: number,
	above: boolean
): number {
	if (threshold < 0 || threshold > 1) {
		throw new Error(`Threshold must be in [0, 1] range, got ${threshold}`);
	}

	return values.filter((val) => (above ? val >= threshold : val < threshold)).length;
}

/**
 * Calculate pass rate (percentage of values >= threshold)
 *
 * @param values - Array of Score values
 * @param threshold - Pass threshold (default: 0.5)
 * @returns Pass rate as a Score [0, 1]
 */
export function calculatePassRate(values: readonly Score[], threshold = 0.5): Score {
	if (values.length === 0) {
		throw new Error('Cannot calculate pass rate of empty array');
	}

	if (threshold < 0 || threshold > 1) {
		throw new Error(`Threshold must be in [0, 1] range, got ${threshold}`);
	}

	const passCount = countThreshold(values, threshold, true);
	return toScore(passCount / values.length);
}

