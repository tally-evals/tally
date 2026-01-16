/**
 * Z-score normalizer
 *
 * Normalizes values using z-score transformation:
 * z = (value - mean) / stdDev
 *
 * Then converts z-score to [0, 1] range using sigmoid or linear transformation
 * Supports clipping and direction preference
 */

import type { NormalizerSpec, Score, ScoringContext } from '@tally/core/types';
import { toScore } from '@tally/core/types';

/**
 * Apply z-score normalization
 */
export function normalizeZScore(
  value: number,
  spec: Extract<NormalizerSpec<number, ScoringContext>, { type: 'z-score' }>,
  context: ScoringContext
): Score {
  // Read mean/stdDev from spec, with fallback to context
  const mean =
    spec.mean ?? context.distribution?.mean ?? (context.extra?.mean as number | undefined);
  const stdDev =
    spec.stdDev ?? context.distribution?.stdDev ?? (context.extra?.stdDev as number | undefined);

  if (mean === undefined || stdDev === undefined) {
    throw new Error('Z-score normalizer requires mean and stdDev in spec or context.distribution');
  }

  const clip = spec.clip ?? context.clip ?? false;
  const direction = spec.direction ?? context.direction;

  if (stdDev === 0) {
    // Edge case: no variance, all values are the same
    // Return 0.5 as neutral score
    return toScore(0.5);
  }

  // Calculate z-score
  const zScore = (value - mean) / stdDev;

  // Convert z-score to [0, 1] using sigmoid function
  // sigmoid(z) = 1 / (1 + exp(-z))
  // This maps z-scores to [0, 1] range smoothly
  let normalized = 1 / (1 + Math.exp(-zScore));

  // Handle direction preference
  if (direction === 'lower') {
    // Invert: lower values are better
    normalized = 1 - normalized;
  }

  // Apply clipping if requested
  if (clip) {
    normalized = Math.max(0, Math.min(1, normalized));
  }

  // The sigmoid function already ensures [0, 1] range, but we validate anyway
  return toScore(normalized);
}
