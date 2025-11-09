/**
 * Linear normalizer
 * 
 * Applies a linear transformation: normalized = slope * value + intercept
 * Then clips to [0, 1] range if clip is enabled
 * Supports direction preference
 */

import type { Score, ScoringContext, NormalizerSpec } from '@tally/core/types';
import { toScore } from '@tally/core/types';

/**
 * Apply linear normalization
 */
export function normalizeLinear(
	value: number,
	spec: Extract<NormalizerSpec<number, ScoringContext>, { type: 'linear' }>,
	context: ScoringContext
): Score {
	// Read slope/intercept from spec, with fallback to context
	const slope = spec.slope ?? context.extra?.slope as number | undefined;
	const intercept = spec.intercept ?? context.extra?.intercept as number | undefined;

	if (slope === undefined || intercept === undefined) {
		throw new Error(
			'Linear normalizer requires slope and intercept in spec or context.extra'
		);
	}

	// Apply linear transformation
	let normalized = slope * value + intercept;

	const direction = spec.direction ?? context.direction;

	// Handle direction preference
	if (direction === 'lower') {
		// Invert: lower values are better
		normalized = 1 - normalized;
	}

	// Apply clipping if requested
	const clipRange = spec.clip;
	if (clipRange) {
		normalized = Math.max(clipRange[0], Math.min(clipRange[1], normalized));
	} else {
		const clip = context.clip ?? false;
		if (clip) {
			// Default clip to [0, 1]
			normalized = Math.max(0, Math.min(1, normalized));
		} else {
			// Validate range without clipping
			if (normalized < 0 || normalized > 1) {
				throw new Error(
					`Linear normalized value ${normalized} is out of [0, 1] range. ` +
					`Consider enabling clip option or adjusting slope/intercept.`
				);
			}
		}
	}

	return toScore(normalized);
}

