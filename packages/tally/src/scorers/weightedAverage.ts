/**
 * Weighted Average Scorer
 *
 * Combines multiple normalized metrics using weighted average.
 * Weights are automatically normalized to sum to 1.0.
 */

import { ScorerBuilder } from '../core/builders/ScorerBuilder';
import type { BaseMetricDef, InputScores, Score, Scorer, ScorerInput } from '../core/types';
import { toScore } from '../core/types';

/**
 * Compute weighted average of scores
 *
 * @param scores - Map of metric names to their normalized scores
 * @param inputs - Array of scorer inputs with weights
 * @param normalizeWeights - Whether to normalize weights (default: true)
 * @returns Weighted average score in [0, 1] range
 */
function computeWeightedAverage<TInputs extends readonly ScorerInput[]>(
  scores: InputScores<TInputs>,
  inputs: TInputs,
  normalizeWeights = true
): Score {
  if (inputs.length === 0) {
    throw new Error('Cannot compute weighted average with no inputs');
  }

  // Calculate total weight
  let totalWeight = 0;
  for (const input of inputs) {
    if (input.required !== false) {
      // Check if score exists for this metric
      const metricName = input.metric.name;
      const score = (scores as Record<string, Score>)[metricName];
      if (score === undefined) {
        throw new Error(`Required metric "${metricName}" is missing from scores`);
      }
      totalWeight += Math.abs(input.weight);
    }
  }

  if (totalWeight === 0) {
    throw new Error('Total weight cannot be zero');
  }

  // Compute weighted sum
  let weightedSum = 0;
  let usedWeight = 0;

  for (const input of inputs) {
    const metricName = input.metric.name;
    const score = (scores as Record<string, Score>)[metricName];

    // Skip optional metrics that are missing
    if (score === undefined) {
      if (input.required === false) {
        continue;
      }
      throw new Error(`Required metric "${metricName}" is missing from scores`);
    }

    // Validate score is in [0, 1] range
    if (typeof score !== 'number' || score < 0 || score > 1) {
      throw new Error(`Score for metric "${metricName}" must be in [0, 1] range, got ${score}`);
    }

    const weight = normalizeWeights ? Math.abs(input.weight) / totalWeight : Math.abs(input.weight);

    weightedSum += score * weight;
    usedWeight += weight;
  }

  // Normalize by used weight if weights weren't normalized
  const result = normalizeWeights ? weightedSum : weightedSum / usedWeight;

  // Ensure result is in [0, 1] range
  return toScore(Math.max(0, Math.min(1, result)));
}

/**
 * Options for creating a weighted average scorer
 */
export interface CreateWeightedAverageScorerOptions<TInputs extends readonly ScorerInput[]> {
  name: string;
  output: BaseMetricDef<number>;
  inputs: TInputs;
  normalizeWeights?: boolean;
  fallbackScore?: Score;
  description?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Create a weighted average scorer
 *
 * Uses ScorerBuilder to construct a scorer that combines normalized metrics
 * using weighted average. Weights are normalized to sum to 1.0 by default.
 *
 * @param options - Configuration object with name, output, inputs, and optional settings
 * @returns Scorer that combines metrics using weighted average
 */
export function createWeightedAverageScorer<TInputs extends readonly ScorerInput[]>(
  options: CreateWeightedAverageScorerOptions<TInputs>
): Scorer<TInputs> {
  const {
    name,
    output,
    inputs,
    normalizeWeights: normalizeWeightsOption,
    fallbackScore,
    description,
    metadata,
  } = options;

  if (inputs.length === 0) {
    throw new Error('Weighted average scorer requires at least one input metric');
  }

  const normalizeWeights = normalizeWeightsOption ?? true;

  // Build scorer using ScorerBuilder
  // Note: TypeScript can't track exact type transformations in loops,
  // but the final type is correctly inferred from TInputs parameter
  const builder = ScorerBuilder.create(name, output);

  // Add all inputs using builder pattern
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let currentBuilder: any = builder;
  for (const input of inputs) {
    currentBuilder = currentBuilder.addMetric(
      input.metric,
      input.weight,
      input.normalizerOverride,
      input.required ?? true
    );
  }

  // Build scorer with weighted average combination function
  const scorer = currentBuilder
    .withNormalizeWeights(normalizeWeights)
    .withCombineScores((scores: InputScores<TInputs>) =>
      computeWeightedAverage(scores, inputs, normalizeWeights)
    )
    .withDescription(description ?? `Weighted average scorer combining ${inputs.length} metrics`)
    .build() as Scorer<TInputs>;

  // Apply optional overrides
  return {
    ...scorer,
    ...(fallbackScore !== undefined && {
      fallbackScore,
    }),
    ...(metadata && { metadata }),
    metadata: {
      ...(scorer.metadata ?? {}),
      ...(metadata ?? {}),
      // Tag for run-artifact serialization: allows UI to explain “how calculated”
      __tally: {
        ...(typeof (scorer.metadata as any)?.__tally === 'object'
          ? (scorer.metadata as any).__tally
          : {}),
        combineKind: 'weightedAverage',
      },
    },
  };
}
