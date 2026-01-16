/**
 * Threshold normalizer
 *
 * Maps values above/below a threshold to fixed scores
 * - Values >= threshold: map to `above` score (default: 1.0)
 * - Values < threshold: map to `below` score (default: 0.0)
 */

import type { NormalizerSpec, Score, ScoringContext } from '@tally/core/types';
import { toScore } from '@tally/core/types';

/**
 * Apply threshold normalization
 */
export function normalizeThreshold(
  value: number,
  spec: Extract<NormalizerSpec<number, ScoringContext>, { type: 'threshold' }>,
  context: ScoringContext
): Score {
  // Read threshold from spec, with fallback to context
  const threshold =
    spec.threshold ?? context.thresholds?.pass ?? (context.extra?.threshold as number | undefined);

  if (threshold === undefined) {
    throw new Error('Threshold normalizer requires threshold in spec or context.thresholds.pass');
  }

  const above = spec.above ?? (context.extra?.above as number | undefined) ?? 1.0;
  const below = spec.below ?? (context.extra?.below as number | undefined) ?? 0.0;

  // Validate above and below are in [0, 1] range
  if (above < 0 || above > 1 || below < 0 || below > 1) {
    throw new Error(
      `Threshold normalizer above (${above}) and below (${below}) must be in [0, 1] range`
    );
  }

  const score = value >= threshold ? above : below;
  return toScore(score);
}
