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
	
	LLMMetricFields,
	MetricDef,
	MetricScalar,
	MetricContainer,
	SingleTurnContainer,
	MultiTurnContainer,
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
} from '@tally/core/types';
import type { Eval } from './evals/types';

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
	TMetric extends BaseMetricDef<T> | MetricDef<T, MetricContainer>
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
	TMetric extends BaseMetricDef<T> | MetricDef<T, MetricContainer>
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
	TContainer extends SingleTurnContainer = SingleTurnContainer
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
	TContainer extends SingleTurnContainer = SingleTurnContainer,
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
	runOnContainer: MultiTurnMetricDef<T, MultiTurnContainer>['runOnContainer'];
	compute: CodeMetricFields<T>['compute'];
	dependencies?: CodeMetricFields<T>['dependencies'];
	cacheable?: CodeMetricFields<T>['cacheable'];
	normalization?: MetricNormalization<T, ScoringContext>;
	metadata?: Record<string, unknown>;
}): MetricDef<T, MultiTurnContainer> {
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
	} as MetricDef<T, MultiTurnContainer>;
}

export function createMultiTurnLLM<
	T extends MetricScalar,
	TContainer extends MultiTurnContainer = MultiTurnContainer,
	V extends VarsTuple = readonly []
>(args: {
	base: BaseMetricDef<T>;
	runOnContainer: MultiTurnMetricDef<T, TContainer>['runOnContainer'];
	provider: LLMMetricFields<T, V>['provider'];
	prompt: LLMMetricFields<T, V>['prompt'];
	rubric?: LLMMetricFields<T, V>['rubric'];
	postProcessing?: LLMMetricFields<T, V>['postProcessing'];
	normalization?: MetricNormalization<T, ScoringContext>;
	metadata?: Record<string, unknown>;
}): MetricDef<T, TContainer> {
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
	} as MetricDef<T, TContainer>;
}

// -----------------------------------------------------------------------------
// Scorer Factories
// -----------------------------------------------------------------------------

export function defineInput<
	// biome-ignore lint/suspicious/noExplicitAny: Accept any TRawValue and TContainer to avoid variance issues
	M extends SingleTurnMetricDef<any, any> | MultiTurnMetricDef<any, any>,
	// biome-ignore lint/suspicious/noExplicitAny: Infer TRawValue from the metric type
	TRawValue extends MetricScalar = M extends SingleTurnMetricDef<infer T, any>
		? T
		// biome-ignore lint/suspicious/noExplicitAny: Infer TRawValue from MultiTurnMetricDef
		: M extends MultiTurnMetricDef<infer T, any>
		? T
		: MetricScalar
>(args: {
	metric: M;
	weight: number;
	normalizerOverride?:
		| NormalizerSpec<TRawValue, ScoringContext>
		| NormalizeToScore<TRawValue, ScoringContext>;
	required?: boolean;
}): ScorerInput<MetricDef<MetricScalar, MetricContainer>, ScoringContext> {
	return {
		metric: args.metric as unknown as MetricDef<MetricScalar, MetricContainer>,
		weight: args.weight,
		required: args.required ?? true,
		...(args.normalizerOverride !== undefined && { normalizerOverride: args.normalizerOverride }),
	} as ScorerInput<MetricDef<MetricScalar, MetricContainer>, ScoringContext>;
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

/**
 * Create an evaluator with evals (new API)
 * Accepts any eval types to allow mixing single-turn and multi-turn evals
 */
export function createEvaluator<TContainer extends MetricContainer = MetricContainer>(args: {
	name: string;
	evals: readonly Eval<MetricContainer>[];
	context: EvaluationContext; // REQUIRED
	description?: string;
	metadata?: Record<string, unknown>;
}): Evaluator<TContainer> {
	const { name, evals, context, description, metadata } = args;
	if (!Array.isArray(evals) || evals.length === 0) {
		throw new Error('createEvaluator: evals must be a non-empty array');
	}
	if (!context) {
		throw new Error('createEvaluator: context is required');
	}
	return {
		name,
		...(description !== undefined && { description }),
		evals: evals as readonly Eval<TContainer>[],
		context,
		...(metadata !== undefined && { metadata }),
	};
}


