/**
 * Min-max normalizer
 *
 * Normalizes values to [0, 1] range using min-max scaling:
 * normalized = (value - min) / (max - min)
 *
 * Supports clipping and direction preference
 */

import type { NormalizerSpec, NumericNormalizationContext, Score } from '@tally/core/types';
import { toScore } from '@tally/core/types';

/**
 * Apply min-max normalization
 */
export function normalizeMinMax(
  value: number,
  spec: Extract<NormalizerSpec<number, NumericNormalizationContext>, { type: 'min-max' }>,
  context: NumericNormalizationContext
): Score {
  // Read min/max from spec, with fallback to context
  const min = spec.min ?? context.range?.min;
  const max = spec.max ?? context.range?.max;

  if (min === undefined || max === undefined) {
    throw new Error('Min-max normalizer requires min and max values in spec or context.range');
  }

  const clip = spec.clip ?? context.clip ?? false;
  const direction = spec.direction ?? context.direction;

  if (min === max) {
    // Edge case: all values are the same
    // Return 0.5 as neutral score, or 1.0 if direction is 'higher' and value equals min/max
    if (direction === 'higher' && value >= max) {
      return toScore(1);
    }
    if (direction === 'lower' && value <= min) {
      return toScore(1);
    }
    return toScore(0.5);
  }

  // Normalize to [0, 1]
  let normalized = (value - min) / (max - min);

  // Handle direction preference
  if (direction === 'lower') {
    // Invert: lower values are better
    normalized = 1 - normalized;
  }

  // Apply clipping if requested
  if (clip) {
    normalized = Math.max(0, Math.min(1, normalized));
  } else {
    // Validate range without clipping
    if (normalized < 0 || normalized > 1) {
      throw new Error(
        `Min-max normalized value ${normalized} is out of [0, 1] range. ` +
          `Consider enabling clip option or adjusting min/max bounds.`
      );
    }
  }

  return toScore(normalized);
}
