/**
 * Functional factory APIs for defining metrics and scorers.
 *
 * These factories provide a composition-first alternative to the builder pattern.
 * They return plain objects that conform to the existing types and can be easily
 * composed, cloned, and serialized.
 */

import type {
	BaseMetricDef,
	CodeMetricFields,
	Conversation,
	LLMMetricFields,
	MetricDef,
	MetricScalar,
	MultiTurnMetricDef,
	NormalizerSpec,
	NormalizeToScore,
	Scorer,
	ScorerInput,
	Score,
	ScoringContext,
	SingleTurnMetricDef,
	VarsTuple,
	MetricNormalization,
	InputScores,
	EvaluationContext,
	Evaluator,
	MetricDefFor,
} from '@tally/core/types';

// -----------------------------------------------------------------------------
// Base Metric Definition
// -----------------------------------------------------------------------------

export function defineBaseMetric<T extends MetricScalar>(args: {
	name: string;
	valueType: BaseMetricDef<T>['valueType'];
	description?: string;
	metadata?: Record<string, unknown>;
	normalization?: MetricNormalization<T, ScoringContext>;
}): BaseMetricDef<T> {
	const { name, valueType, description, metadata, normalization } = args;
	return {
		name,
		valueType,
		...(description !== undefined && { description }),
		...(metadata !== undefined && { metadata }),
		...(normalization !== undefined && { normalization }),
	};
}

export function withNormalization<
	T extends MetricScalar,
	TMetric extends BaseMetricDef<T> | MetricDef<T, unknown>
>(args: {
	metric: TMetric;
	default: NormalizerSpec<T, ScoringContext> | NormalizeToScore<T, ScoringContext>;
	context?:
		| ScoringContext
		| ((args: { dataset: readonly unknown[]; rawValues: readonly T[] }) => Promise<ScoringContext> | ScoringContext);
}): TMetric {
	const normalization: MetricNormalization<T, ScoringContext> = {
		default: args.default,
		...(args.context !== undefined && { context: args.context }),
	};
	return {
		...args.metric,
		normalization,
	} as TMetric;
}

export function withMetadata<
	T extends MetricScalar,
	TMetric extends BaseMetricDef<T> | MetricDef<T, unknown>
>(metric: TMetric, metadata: Record<string, unknown>): TMetric {
	return {
		...metric,
		metadata: {
			...((metric as BaseMetricDef<T>).metadata || {}),
			...metadata,
		},
	} as TMetric;
}

// -----------------------------------------------------------------------------
// Single-Turn Metric Factories
// -----------------------------------------------------------------------------

export function createSingleTurnCode<
	T extends MetricScalar,
	TContainer
>(args: {
	base: BaseMetricDef<T>;
	preProcessor?: SingleTurnMetricDef<T, TContainer>['preProcessor'];
	compute: CodeMetricFields<T>['compute'];
	dependencies?: CodeMetricFields<T>['dependencies'];
	cacheable?: CodeMetricFields<T>['cacheable'];
	normalization?: MetricNormalization<T, ScoringContext>;
	metadata?: Record<string, unknown>;
}): MetricDef<T, TContainer> {
	const { base, preProcessor, compute, dependencies, cacheable, normalization, metadata } = args;
	const mergedBase: BaseMetricDef<T> = {
		...base,
		...(normalization !== undefined && { normalization }),
		...(metadata !== undefined && { metadata: { ...(base.metadata || {}), ...metadata } }),
	};
	return {
		...mergedBase,
		scope: 'single',
		type: 'code-based',
		compute,
		...(dependencies !== undefined && { dependencies }),
		...(cacheable !== undefined && { cacheable }),
		...(preProcessor !== undefined && { preProcessor }),
	} as MetricDef<T, TContainer>;
}

export function createSingleTurnLLM<
	T extends MetricScalar,
	TContainer,
	V extends VarsTuple = readonly []
>(args: {
	base: BaseMetricDef<T>;
	preProcessor?: SingleTurnMetricDef<T, TContainer>['preProcessor'];
	provider: LLMMetricFields<T, V>['provider'];
	prompt: LLMMetricFields<T, V>['prompt'];
	rubric?: LLMMetricFields<T, V>['rubric'];
	postProcessing?: LLMMetricFields<T, V>['postProcessing'];
	normalization?: MetricNormalization<T, ScoringContext>;
	metadata?: Record<string, unknown>;
}): MetricDef<T, TContainer> {
	const { base, preProcessor, provider, prompt, rubric, postProcessing, normalization, metadata } = args;
	const mergedBase: BaseMetricDef<T> = {
		...base,
		...(normalization !== undefined && { normalization }),
		...(metadata !== undefined && { metadata: { ...(base.metadata || {}), ...metadata } }),
	};
	// Cast LLM fields to the default TVars = readonly [] expected by MetricDef union
	const llmFields = {
		provider,
		prompt,
		...(rubric !== undefined && { rubric }),
		...(postProcessing !== undefined && { postProcessing }),
	} as unknown as Omit<LLMMetricFields<T, readonly []>, 'type'>;
	return {
		...mergedBase,
		scope: 'single',
		type: 'llm-based',
		...llmFields,
		...(preProcessor !== undefined && { preProcessor }),
	} as MetricDef<T, TContainer>;
}

// -----------------------------------------------------------------------------
// Multi-Turn Metric Factories
// -----------------------------------------------------------------------------

export function createMultiTurnCode<T extends MetricScalar>(args: {
	base: BaseMetricDef<T>;
	runOnContainer: MultiTurnMetricDef<T, Conversation>['runOnContainer'];
	compute: CodeMetricFields<T>['compute'];
	dependencies?: CodeMetricFields<T>['dependencies'];
	cacheable?: CodeMetricFields<T>['cacheable'];
	normalization?: MetricNormalization<T, ScoringContext>;
	metadata?: Record<string, unknown>;
}): MetricDef<T, Conversation> {
	const { base, runOnContainer, compute, dependencies, cacheable, normalization, metadata } = args;
	const mergedBase: BaseMetricDef<T> = {
		...base,
		...(normalization !== undefined && { normalization }),
		...(metadata !== undefined && { metadata: { ...(base.metadata || {}), ...metadata } }),
	};
	return {
		...mergedBase,
		scope: 'multi',
		type: 'code-based',
		compute,
		...(dependencies !== undefined && { dependencies }),
		...(cacheable !== undefined && { cacheable }),
		runOnContainer,
	} as MetricDef<T, Conversation>;
}

export function createMultiTurnLLM<
	T extends MetricScalar,
	V extends VarsTuple = readonly []
>(args: {
	base: BaseMetricDef<T>;
	runOnContainer: MultiTurnMetricDef<T, Conversation>['runOnContainer'];
	provider: LLMMetricFields<T, V>['provider'];
	prompt: LLMMetricFields<T, V>['prompt'];
	rubric?: LLMMetricFields<T, V>['rubric'];
	postProcessing?: LLMMetricFields<T, V>['postProcessing'];
	normalization?: MetricNormalization<T, ScoringContext>;
	metadata?: Record<string, unknown>;
}): MetricDef<T, Conversation> {
	const { base, runOnContainer, provider, prompt, rubric, postProcessing, normalization, metadata } = args;
	const mergedBase: BaseMetricDef<T> = {
		...base,
		...(normalization !== undefined && { normalization }),
		...(metadata !== undefined && { metadata: { ...(base.metadata || {}), ...metadata } }),
	};
	// Cast LLM fields to the default TVars = readonly [] expected by MetricDef union
	const llmFields = {
		provider,
		prompt,
		...(rubric !== undefined && { rubric }),
		...(postProcessing !== undefined && { postProcessing }),
	} as unknown as Omit<LLMMetricFields<T, readonly []>, 'type'>;
	return {
		...mergedBase,
		scope: 'multi',
		type: 'llm-based',
		...llmFields,
		runOnContainer,
	} as MetricDef<T, Conversation>;
}

// -----------------------------------------------------------------------------
// Scorer Factories
// -----------------------------------------------------------------------------

export function defineInput<
	M extends MetricDef<MetricScalar, unknown>
>(args: {
	metric: M;
	weight: number;
	normalizerOverride?:
		| NormalizerSpec<M extends MetricDef<infer TRawValue, unknown> ? TRawValue : never, ScoringContext>
		| NormalizeToScore<M extends MetricDef<infer TRawValue, unknown> ? TRawValue : never, ScoringContext>;
	required?: boolean;
}): ScorerInput<M, ScoringContext> {
	return {
		metric: args.metric,
		weight: args.weight,
		required: args.required ?? true,
		...(args.normalizerOverride !== undefined && { normalizerOverride: args.normalizerOverride }),
	} as ScorerInput<M, ScoringContext>;
}

export function defineScorer<
	TInputs extends readonly ScorerInput[] = readonly ScorerInput[]
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

// -----------------------------------------------------------------------------
// Evaluator Factory
// -----------------------------------------------------------------------------

export function createEvaluator<
	TContainer,
	TInputs extends readonly MetricDefFor<TContainer>[]
>(args: {
	name: string;
	metrics: TInputs;
	scorer: Scorer;
	context?: EvaluationContext;
	description?: string;
}): Evaluator<TContainer, TInputs> {
	const { name, metrics, scorer, context, description } = args;
	if (!Array.isArray(metrics) || metrics.length === 0) {
		throw new Error('createEvaluator: metrics must be a non-empty array');
	}
	if (!scorer) {
		throw new Error('createEvaluator: scorer is required');
	}
	return {
		name,
		...(description !== undefined && { description }),
		metrics,
		scorer,
		...(context !== undefined && { context }),
	};
}


