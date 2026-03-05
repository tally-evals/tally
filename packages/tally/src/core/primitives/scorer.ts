/**
 * Scorer Definition Primitives
 *
 * Low-level building blocks for defining scorers.
 * Use these to create custom scorer implementations.
 */

import type {
  InputScores,
  MetricContainer,
  MetricDef,
  MetricScalar,
  MultiTurnMetricDef,
  NormalizationContextFor,
  NormalizeToScore,
  NormalizerSpec,
  Score,
  Scorer,
  ScorerInput,
  SingleTurnMetricDef,
  BaseMetricDef,
} from '../types';

/**
 * Creates a scorer input configuration.
 *
 * @typeParam TMetric - The metric definition type
 * @typeParam TMetricValue - The metric value type (inferred from metric)
 *
 * @example
 * ```typescript
 * const input = defineInput({
 *   metric: relevanceMetric,
 *   weight: 0.4,
 * });
 * ```
 */
export function defineInput<
  // biome-ignore lint/suspicious/noExplicitAny: Accept any TMetricValue and TContainer to avoid variance issues
  TMetric extends SingleTurnMetricDef<any, any> | MultiTurnMetricDef<any, any>,
  // biome-ignore lint/suspicious/noExplicitAny: Infer TMetricValue from the metric type
  TMetricValue extends MetricScalar = TMetric extends SingleTurnMetricDef<infer V, any>
    ? V
    : // biome-ignore lint/suspicious/noExplicitAny: Infer TMetricValue from MultiTurnMetricDef
      TMetric extends MultiTurnMetricDef<infer V, any>
      ? V
      : MetricScalar,
>(args: {
  metric: TMetric;
  weight: number;
  normalizerOverride?:
    | NormalizerSpec<TMetricValue, NormalizationContextFor<TMetricValue>>
    | NormalizeToScore<TMetricValue, NormalizationContextFor<TMetricValue>>;
  required?: boolean;
}): ScorerInput<MetricDef<MetricScalar, MetricContainer>, NormalizationContextFor<MetricScalar>> {
  return {
    metric: args.metric as unknown as MetricDef<MetricScalar, MetricContainer>,
    weight: args.weight,
    required: args.required ?? true,
    ...(args.normalizerOverride !== undefined && {
      normalizerOverride: args.normalizerOverride,
    }),
  } as ScorerInput<MetricDef<MetricScalar, MetricContainer>, NormalizationContextFor<MetricScalar>>;
}

/**
 * Creates a scorer definition.
 *
 * @typeParam TInputs - The scorer inputs tuple
 *
 * @example
 * ```typescript
 * const scorer = defineScorer({
 *   name: 'QualityScore',
 *   output: qualityMetric,
 *   inputs: [relevanceInput, accuracyInput],
 * });
 * ```
 */
export function defineScorer<
  TInputs extends readonly ScorerInput[] = readonly ScorerInput[],
>(args: {
  name: string;
  output: BaseMetricDef<number>;
  inputs: TInputs;
  normalizeWeights?: boolean;
  combineScores?: (scores: InputScores<TInputs>) => Score;
  fallbackScore?: Score;
  metadata?: Record<string, unknown>;
  description?: string;
}): Scorer<TInputs> {
  const {
    name,
    output,
    inputs,
    normalizeWeights = true,
    combineScores,
    fallbackScore,
    metadata,
    description,
  } = args;
  return {
    name,
    output,
    inputs,
    ...(description !== undefined && { description }),
    ...(normalizeWeights !== undefined && { normalizeWeights }),
    ...(combineScores !== undefined && { combineScores }),
    ...(fallbackScore !== undefined && { fallbackScore }),
    ...(metadata !== undefined && { metadata }),
  };
}
