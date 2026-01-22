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
import { calculateMean, sortScores, calculatePercentile } from '../aggregators/base';
import { computeVerdict } from './verdict';

/**
 * Calculate built-in aggregations for a set of scores
 */
export function calculateBuiltInAggregations(
	scores: readonly Score[],
	rawValues?: readonly MetricScalar[],
	verdictPolicy?: VerdictPolicy
): BuiltInAggregations {
	if (scores.length === 0) {
		throw new Error('Cannot calculate aggregations for empty scores array');
	}

	const sortedScores = sortScores(scores);
	const mean = calculateMean(scores);

	const percentiles = {
		p50: calculatePercentile(sortedScores, 50),
		p75: calculatePercentile(sortedScores, 75),
		p90: calculatePercentile(sortedScores, 90),
		p95: calculatePercentile(sortedScores, 95),
		p99: calculatePercentile(sortedScores, 99),
	};

	const aggregations: BuiltInAggregations = {
		mean,
		percentiles,
	};

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
	rawValues?: readonly MetricScalar[]
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
export function calculateDistribution(rawValues: readonly MetricScalar[]): Record<string, number> {
	const distribution: Record<string, number> = {};
	for (const value of rawValues) {
		const key = String(value);
		distribution[key] = (distribution[key] ?? 0) + 1;
	}
	return distribution;
}

/**
 * Calculate percentiles (p50, p75, p90, p95, p99)
 */
export function calculatePercentiles(scores: readonly Score[]): {
	p50: Score;
	p75: Score;
	p90: Score;
	p95: Score;
	p99: Score;
} {
	if (scores.length === 0) {
		throw new Error('Cannot calculate percentiles for empty scores array');
	}

	const sortedScores = sortScores(scores);
	return {
		p50: calculatePercentile(sortedScores, 50),
		p75: calculatePercentile(sortedScores, 75),
		p90: calculatePercentile(sortedScores, 90),
		p95: calculatePercentile(sortedScores, 95),
		p99: calculatePercentile(sortedScores, 99),
	};
}

