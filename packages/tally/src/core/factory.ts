/**
 * Functional factory APIs for defining metrics and scorers.
 *
 * These factories provide a composition-first alternative to the builder pattern.
 * They return plain objects that conform to the existing types and can be easily
 * composed, cloned, and serialized.
 */

import type {
  Aggregator,
  BaseMetricDef,
  CodeMetricFields,
  CompatibleAggregator,
  InputScores,
  LLMMetricFields,
  MetricContainer,
  MetricDef,
  MetricNormalization,
  MetricScalar,
  MultiTurnContainer,
  MultiTurnMetricDef,
  NormalizationContextFor,
  NormalizeToScore,
  NormalizerSpec,
  Score,
  Scorer,
  ScorerInput,
  SingleTurnContainer,
  SingleTurnMetricDef,
  VarsTuple,
} from '@tally/core/types';
import { getDefaultAggregators } from '../aggregators/default';

// -----------------------------------------------------------------------------
// Base Metric Definition
// -----------------------------------------------------------------------------

/**
 * Creates a base metric definition.
 *
 * @typeParam TMetricValue - The metric value type (number, boolean, or string)
 *
 * @example
 * ```typescript
 * const base = defineBaseMetric({
 *   name: 'relevance',
 *   valueType: 'number',
 *   description: 'Measures answer relevance',
 * });
 * ```
 */
export function defineBaseMetric<TMetricValue extends MetricScalar>(args: {
  name: string;
  valueType: BaseMetricDef<TMetricValue>['valueType'];
  description?: string;
  metadata?: Record<string, unknown>;
  normalization?: MetricNormalization<TMetricValue, NormalizationContextFor<TMetricValue>>;
}): BaseMetricDef<TMetricValue> {
  const { name, valueType, description, metadata, normalization } = args;
  return {
    name,
    valueType,
    ...(description !== undefined && { description }),
    ...(metadata !== undefined && { metadata }),
    ...(normalization !== undefined && { normalization }),
  };
}

/**
 * Adds normalization configuration to a metric.
 *
 * @typeParam TMetricValue - The metric value type
 * @typeParam TMetric - The metric definition type
 */
export function withNormalization<
  TMetricValue extends MetricScalar,
  TMetric extends (BaseMetricDef<TMetricValue> | MetricDef<TMetricValue, MetricContainer>) & object,
>(args: {
  metric: TMetric;
  normalizer:
    | NormalizerSpec<TMetricValue, NormalizationContextFor<TMetricValue>>
    | NormalizeToScore<TMetricValue, NormalizationContextFor<TMetricValue>>;
  calibrate?:
    | NormalizationContextFor<TMetricValue>
    | ((args: {
        dataset: readonly unknown[];
        rawValues: readonly TMetricValue[];
      }) => Promise<NormalizationContextFor<TMetricValue>> | NormalizationContextFor<TMetricValue>);
}): TMetric {
  const normalization: MetricNormalization<TMetricValue, NormalizationContextFor<TMetricValue>> = {
    normalizer: args.normalizer,
    ...(args.calibrate !== undefined && { calibrate: args.calibrate }),
  };
  return {
    ...args.metric,
    normalization,
  } as TMetric;
}

/**
 * Adds metadata to a metric definition.
 *
 * @typeParam TMetricValue - The metric value type
 * @typeParam TMetric - The metric definition type
 */
export function withMetadata<
  TMetricValue extends MetricScalar,
  TMetric extends BaseMetricDef<TMetricValue> | MetricDef<TMetricValue, MetricContainer>,
>(metric: TMetric, metadata: Record<string, unknown>): TMetric {
  return {
    ...metric,
    metadata: {
      ...((metric as BaseMetricDef<TMetricValue>).metadata || {}),
      ...metadata,
    },
  } as TMetric;
}

/**
 * Binds an aggregator to a metric.
 *
 * @typeParam TMetricValue - The metric value type
 * @typeParam TContainer - The container type
 */
export function withMetric<TMetricValue extends MetricScalar, TContainer extends SingleTurnContainer>(
  metric: SingleTurnMetricDef<TMetricValue, TContainer>,
  aggregator: CompatibleAggregator<TMetricValue>
): Aggregator<TMetricValue, TContainer> {
  return {
    ...aggregator,
    metric,
  } as Aggregator<TMetricValue, TContainer>;
}

// -----------------------------------------------------------------------------
// Single-Turn Metric Factories
// -----------------------------------------------------------------------------

/**
 * Creates a code-based single-turn metric.
 *
 * @typeParam TMetricValue - The metric value type
 * @typeParam TContainer - The container type
 */
export function createSingleTurnCode<
  TMetricValue extends MetricScalar,
  TContainer extends SingleTurnContainer = SingleTurnContainer,
>(args: {
  base: BaseMetricDef<TMetricValue>;
  preProcessor?: SingleTurnMetricDef<TMetricValue, TContainer>['preProcessor'];
  compute: CodeMetricFields<TMetricValue>['compute'];
  dependencies?: CodeMetricFields<TMetricValue>['dependencies'];
  cacheable?: CodeMetricFields<TMetricValue>['cacheable'];
  normalization?: MetricNormalization<TMetricValue, NormalizationContextFor<TMetricValue>>;
  metadata?: Record<string, unknown>;
  aggregators?: CompatibleAggregator<TMetricValue>[];
}): MetricDef<TMetricValue, TContainer> {
  const {
    base,
    preProcessor,
    compute,
    dependencies,
    cacheable,
    normalization,
    metadata,
    aggregators,
  } = args;
  const mergedBase: SingleTurnMetricDef<TMetricValue, TContainer> = {
    scope: 'single',
    ...base,
    ...(normalization !== undefined && { normalization }),
    ...(metadata !== undefined && {
      metadata: { ...(base.metadata || {}), ...metadata },
    }),
  };
  return {
    ...mergedBase,
    type: 'code-based',
    compute,
    ...(dependencies !== undefined && { dependencies }),
    ...(cacheable !== undefined && { cacheable }),
    ...(preProcessor !== undefined && { preProcessor }),
    aggregators: [...(aggregators ?? []), ...getDefaultAggregators<TMetricValue>(base.valueType)].map(
      (aggregator) => withMetric<TMetricValue, TContainer>(mergedBase, aggregator)
    ),
  } as MetricDef<TMetricValue, TContainer>;
}

/**
 * Creates an LLM-based single-turn metric.
 *
 * @typeParam TMetricValue - The metric value type
 * @typeParam TContainer - The container type
 * @typeParam TPromptVars - Prompt template variable names
 */
export function createSingleTurnLLM<
  TMetricValue extends MetricScalar,
  TContainer extends SingleTurnContainer = SingleTurnContainer,
  TPromptVars extends VarsTuple = readonly [],
>(args: {
  base: BaseMetricDef<TMetricValue>;
  preProcessor?: SingleTurnMetricDef<TMetricValue, TContainer>['preProcessor'];
  provider: LLMMetricFields<TMetricValue, TPromptVars>['provider'];
  prompt: LLMMetricFields<TMetricValue, TPromptVars>['prompt'];
  rubric?: LLMMetricFields<TMetricValue, TPromptVars>['rubric'];
  postProcessing?: LLMMetricFields<TMetricValue, TPromptVars>['postProcessing'];
  normalization?: MetricNormalization<TMetricValue, NormalizationContextFor<TMetricValue>>;
  metadata?: Record<string, unknown>;
  aggregators?: CompatibleAggregator<TMetricValue>[];
}): MetricDef<TMetricValue, TContainer> {
  const {
    base,
    preProcessor,
    provider,
    prompt,
    rubric,
    postProcessing,
    normalization,
    metadata,
    aggregators,
  } = args;
  const mergedBase: SingleTurnMetricDef<TMetricValue> = {
    scope: 'single',
    ...base,
    ...(normalization !== undefined && { normalization }),
    ...(metadata !== undefined && {
      metadata: { ...(base.metadata || {}), ...metadata },
    }),
  };
  const llmFields = {
    provider,
    prompt,
    ...(rubric !== undefined && { rubric }),
    ...(postProcessing !== undefined && { postProcessing }),
  } as unknown as Omit<LLMMetricFields<TMetricValue, readonly []>, 'type'>;
  return {
    ...mergedBase,
    type: 'llm-based',
    ...llmFields,
    ...(preProcessor !== undefined && { preProcessor }),
    aggregators: [...(aggregators ?? []), ...getDefaultAggregators<TMetricValue>(base.valueType)].map(
      (aggregator) => withMetric<TMetricValue, TContainer>(mergedBase, aggregator)
    ),
  } as MetricDef<TMetricValue, TContainer>;
}

// -----------------------------------------------------------------------------
// Multi-Turn Metric Factories
// -----------------------------------------------------------------------------

/**
 * Creates a code-based multi-turn metric.
 *
 * @typeParam TMetricValue - The metric value type
 */
export function createMultiTurnCode<TMetricValue extends MetricScalar>(args: {
  base: BaseMetricDef<TMetricValue>;
  runOnContainer: MultiTurnMetricDef<TMetricValue, MultiTurnContainer>['runOnContainer'];
  compute: CodeMetricFields<TMetricValue>['compute'];
  dependencies?: CodeMetricFields<TMetricValue>['dependencies'];
  cacheable?: CodeMetricFields<TMetricValue>['cacheable'];
  normalization?: MetricNormalization<TMetricValue, NormalizationContextFor<TMetricValue>>;
  metadata?: Record<string, unknown>;
}): MetricDef<TMetricValue, MultiTurnContainer> {
  const { base, runOnContainer, compute, dependencies, cacheable, normalization, metadata } = args;
  const mergedBase: BaseMetricDef<TMetricValue> = {
    ...base,
    ...(normalization !== undefined && { normalization }),
    ...(metadata !== undefined && {
      metadata: { ...(base.metadata || {}), ...metadata },
    }),
  };
  return {
    ...mergedBase,
    scope: 'multi',
    type: 'code-based',
    compute,
    ...(dependencies !== undefined && { dependencies }),
    ...(cacheable !== undefined && { cacheable }),
    runOnContainer,
  } as MetricDef<TMetricValue, MultiTurnContainer>;
}

/**
 * Creates an LLM-based multi-turn metric.
 *
 * @typeParam TMetricValue - The metric value type
 * @typeParam TContainer - The container type
 * @typeParam TPromptVars - Prompt template variable names
 */
export function createMultiTurnLLM<
  TMetricValue extends MetricScalar,
  TContainer extends MultiTurnContainer = MultiTurnContainer,
  TPromptVars extends VarsTuple = readonly [],
>(args: {
  base: BaseMetricDef<TMetricValue>;
  runOnContainer: MultiTurnMetricDef<TMetricValue, TContainer>['runOnContainer'];
  provider: LLMMetricFields<TMetricValue, TPromptVars>['provider'];
  prompt: LLMMetricFields<TMetricValue, TPromptVars>['prompt'];
  rubric?: LLMMetricFields<TMetricValue, TPromptVars>['rubric'];
  postProcessing?: LLMMetricFields<TMetricValue, TPromptVars>['postProcessing'];
  normalization?: MetricNormalization<TMetricValue, NormalizationContextFor<TMetricValue>>;
  metadata?: Record<string, unknown>;
}): MetricDef<TMetricValue, TContainer> {
  const {
    base,
    runOnContainer,
    provider,
    prompt,
    rubric,
    postProcessing,
    normalization,
    metadata,
  } = args;
  const mergedBase: BaseMetricDef<TMetricValue> = {
    ...base,
    ...(normalization !== undefined && { normalization }),
    ...(metadata !== undefined && {
      metadata: { ...(base.metadata || {}), ...metadata },
    }),
  };
  const llmFields = {
    provider,
    prompt,
    ...(rubric !== undefined && { rubric }),
    ...(postProcessing !== undefined && { postProcessing }),
  } as unknown as Omit<LLMMetricFields<TMetricValue, readonly []>, 'type'>;
  return {
    ...mergedBase,
    scope: 'multi',
    type: 'llm-based',
    ...llmFields,
    runOnContainer,
  } as MetricDef<TMetricValue, TContainer>;
}

// -----------------------------------------------------------------------------
// Scorer Factories
// -----------------------------------------------------------------------------

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

