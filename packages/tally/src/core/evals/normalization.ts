/**
 * Auto-Normalization Logic for Eval API
 *
 * Handles automatic normalization of boolean and ordinal metrics
 * when they don't have explicit normalization defined.
 */

import type {
  AutoNormalizer,
  MetricContainer,
  MetricDef,
  MetricNormalization,
  MetricScalar,
  NormalizationContextFor,
  NormalizeToScore,
} from '@tally-evals/core';
import { toScore } from '@tally-evals/core';

/**
 * Detect metric value type from metric definition
 */
export function detectMetricValueType<T extends MetricScalar>(
  metric: MetricDef<T, MetricContainer>
): 'boolean' | 'number' | 'string' {
  const valueType = metric.valueType;
  if (valueType === 'boolean') return 'boolean';
  if (valueType === 'number' || valueType === 'ordinal') {
    // For ordinal, we need to check if it's actually a string-based ordinal
    // For now, treat ordinal as string
    return valueType === 'ordinal' ? 'string' : 'number';
  }
  return 'string';
}

/**
 * Check if a metric needs auto-normalization
 * Returns true if metric has no normalization and value type is boolean or ordinal
 */
export function needsAutoNormalization<T extends MetricScalar>(
  metric: MetricDef<T, MetricContainer>
): boolean {
  if (metric.normalization) {
    return false; // Metric already has normalization
  }

  const valueType = detectMetricValueType(metric);
  return valueType === 'boolean' || valueType === 'string'; // string = ordinal
}

/**
 * Apply auto-normalization to a metric definition
 * Creates a normalization spec based on the autoNormalizer configuration
 */
export function applyAutoNormalization<T extends MetricScalar>(
  _metric: MetricDef<T, MetricContainer>,
  autoNormalizer: AutoNormalizer
): MetricNormalization<T, NormalizationContextFor<T>> {
  if (autoNormalizer.kind === 'boolean') {
    const trueScore = autoNormalizer.trueScore ?? 1.0;
    const falseScore = autoNormalizer.falseScore ?? 0.0;

    // Validate scores are in [0, 1] range
    if (trueScore < 0 || trueScore > 1 || falseScore < 0 || falseScore > 1) {
      throw new Error(
        `Auto-normalizer boolean scores must be in [0, 1] range, got trueScore=${trueScore}, falseScore=${falseScore}`
      );
    }

    const normalizeFn: NormalizeToScore<T, NormalizationContextFor<T>> = (value) => {
      return toScore((value as boolean) ? trueScore : falseScore);
    };

    return {
      normalizer: { type: 'custom', normalize: normalizeFn },
    };
  }

  if (autoNormalizer.kind === 'ordinal') {
    const weights = autoNormalizer.weights;
    if (!weights || Object.keys(weights).length === 0) {
      throw new Error('Auto-normalizer ordinal requires non-empty weights map');
    }

    // Validate all weights are in [0, 1] range
    for (const [key, weight] of Object.entries(weights)) {
      if (weight < 0 || weight > 1) {
        throw new Error(
          `Auto-normalizer ordinal weight for "${key}" must be in [0, 1] range, got ${weight}`
        );
      }
    }

    const normalizeFn: NormalizeToScore<T, NormalizationContextFor<T>> = (value) => {
      const weight = weights[value as string];
      if (weight === undefined) {
        // Unknown value - default to 0 or throw?
        // For now, default to 0
        return toScore(0);
      }
      return toScore(weight);
    };

    return {
      normalizer: { type: 'custom', normalize: normalizeFn },
    };
  }

  // kind === 'number' - use identity or metric's existing normalization
  return {
    normalizer: { type: 'identity' },
  };
}

/**
 * Get default auto-normalizer for a metric value type
 * Used when autoNormalize is not explicitly provided
 */
export function getDefaultAutoNormalizer(
  valueType: 'boolean' | 'number' | 'string'
): AutoNormalizer | undefined {
  if (valueType === 'boolean') {
    return { kind: 'boolean', trueScore: 1.0, falseScore: 0.0 };
  }
  // For ordinal (string), we can't provide defaults - user must specify weights
  // For number, no auto-normalization needed
  return undefined;
}
