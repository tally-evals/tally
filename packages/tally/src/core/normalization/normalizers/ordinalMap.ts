/**
 * Ordinal map normalizer
 *
 * Maps ordinal values (strings or numbers) to numeric scores using a lookup table
 * Values not in the map are not supported (will throw error)
 */

import type { MetricScalar, NormalizerSpec, Score, ScoringContext } from '@tally/core/types';
import { toScore } from '@tally/core/types';

/**
 * Apply ordinal map normalization
 */
export function normalizeOrdinalMap(
  value: MetricScalar,
  spec: Extract<NormalizerSpec<string | number, ScoringContext>, { type: 'ordinal-map' }>,
  context: ScoringContext
): Score {
  // Read map from spec, with fallback to context
  const map =
    spec.map ??
    context.ordinalMap ??
    (context.extra?.map as Record<string | number, number> | undefined);

  if (!map) {
    throw new Error('Ordinal map normalizer requires map in spec or context.ordinalMap');
  }

  // Look up the value in the map
  const mappedValue = map[value as string | number];

  if (mappedValue === undefined) {
    throw new Error(
      `Ordinal map normalizer: value "${value}" not found in mapping. ` +
        `Available keys: ${Object.keys(map).join(', ')}`
    );
  }

  // Validate mapped value is in [0, 1] range
  if (mappedValue < 0 || mappedValue > 1) {
    throw new Error(`Ordinal map normalizer: mapped value ${mappedValue} must be in [0, 1] range`);
  }

  return toScore(mappedValue);
}
