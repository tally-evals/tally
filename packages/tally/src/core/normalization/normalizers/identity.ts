/**
 * Identity normalizer
 *
 * Returns the value as-is (assumes it's already in [0, 1] range)
 * For non-number values, converts boolean to 0/1, strings are not supported
 */

import type { MetricScalar, Score } from '@tally/core/types';
import { toScore } from '@tally/core/types';

/**
 * Apply identity normalization
 * For numbers: assumes already in [0, 1] range
 * For booleans: converts true -> 1, false -> 0
 * For strings: throws error (not supported)
 */
export function normalizeIdentity(value: MetricScalar): Score {
  if (typeof value === 'number') {
    // Assume value is already normalized, but validate range
    if (value < 0 || value > 1) {
      throw new Error(`Identity normalizer expects value in [0, 1] range, got ${value}`);
    }
    return toScore(value);
  }

  if (typeof value === 'boolean') {
    return toScore(value ? 1 : 0);
  }

  throw new Error(`Identity normalizer does not support string values, got ${typeof value}`);
}
