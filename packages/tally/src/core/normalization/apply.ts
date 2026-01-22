/**
 * Core normalization application logic
 *
 * Dispatches to appropriate normalizer based on NormalizerSpec type
 * Handles all normalizer types and enforces Score range [0, 1]
 */

import type {
  MetricContainer,
  MetricDef,
  MetricScalar,
  NormalizationContextFor,
  NormalizeToScore,
  NormalizerSpec,
  Score,
} from '@tally/core/types';
import { normalizeCustom } from './normalizers/custom';
import { normalizeIdentity } from './normalizers/identity';
import { normalizeLinear } from './normalizers/linear';
import { normalizeMinMax } from './normalizers/minMax';
import { normalizeOrdinalMap } from './normalizers/ordinalMap';
import { normalizeThreshold } from './normalizers/threshold';
import { normalizeZScore } from './normalizers/zScore';

/**
 * Apply normalization to a raw metric value
 *
 * @param value - Raw metric value to normalize
 * @param normalizerSpec - Normalizer specification (discriminated union)
 * @param context - Scoring context for normalization
 * @param metric - Metric definition (for custom normalizers)
 * @returns Normalized Score in [0, 1] range
 */
export function applyNormalization<T extends MetricScalar>(
  value: T,
  normalizerSpec:
    | NormalizerSpec<T, NormalizationContextFor<T>>
    | NormalizeToScore<T, NormalizationContextFor<T>>,
  context: NormalizationContextFor<T>,
  metric: MetricDef<T, MetricContainer>
): Score {
  // Handle function-based normalizers (custom functions)
  if (typeof normalizerSpec === 'function') {
    return normalizeCustom(value, normalizerSpec, context, metric);
  }

  // Handle NormalizerSpec discriminated union
  switch (normalizerSpec.type) {
    case 'identity':
      return normalizeIdentity(value);

    case 'min-max': {
      return normalizeMinMax(
        value as number,
        normalizerSpec as Extract<
          NormalizerSpec<number, NormalizationContextFor<number>>,
          { type: 'min-max' }
        >,
        context as NormalizationContextFor<number>
      );
    }

    case 'z-score': {
      return normalizeZScore(
        value as number,
        normalizerSpec as Extract<
          NormalizerSpec<number, NormalizationContextFor<number>>,
          { type: 'z-score' }
        >,
        context as NormalizationContextFor<number>
      );
    }

    case 'threshold': {
      return normalizeThreshold(
        value as number,
        normalizerSpec as Extract<
          NormalizerSpec<number, NormalizationContextFor<number>>,
          { type: 'threshold' }
        >,
        context as NormalizationContextFor<number>
      );
    }

    case 'linear': {
      return normalizeLinear(
        value as number,
        normalizerSpec as Extract<
          NormalizerSpec<number, NormalizationContextFor<number>>,
          { type: 'linear' }
        >,
        context as NormalizationContextFor<number>
      );
    }

    case 'ordinal-map': {
      return normalizeOrdinalMap(
        value,
        normalizerSpec as Extract<
          NormalizerSpec<string, NormalizationContextFor<string>>,
          { type: 'ordinal-map' }
        >,
        context as NormalizationContextFor<string>
      );
    }

    case 'custom': {
      return normalizeCustom(value, normalizerSpec.normalize, context, metric);
    }

    default: {
      // Exhaustive check - TypeScript will error if we miss a case
      const _exhaustive: never = normalizerSpec;
      throw new Error(`Unknown normalizer type: ${(_exhaustive as { type: string }).type}`);
    }
  }
}
