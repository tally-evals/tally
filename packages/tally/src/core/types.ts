/**
 * Core type definitions for the Tally evaluation framework
 * 
 * This file contains all foundational types that the rest of the framework builds upon.
 * Types are organized by domain: Data, Metrics, Normalization, Scorers, Evaluators, Aggregators, Reports, and Container.
 */

// Reuse AI SDK's ModelMessage for framework-agnostic conversation messages
import type { ModelMessage } from 'ai';

// ============================================================================
// Data Types
// ============================================================================

export interface DatasetItem {
	id: string;
	prompt: string;
	completion: string;
	metadata?: Record<string, unknown>;
}

export interface ConversationStep {
	stepIndex: number; // stable ordering within the conversation
	input: ModelMessage; // user (or tool) request
	output: readonly ModelMessage[]; // assistant response(s) - array to capture tool calls, tool results, and final response
	id?: string; // provider message id if available
	timestamp?: Date;
	metadata?: Record<string, unknown>;
}

export interface Conversation {
	id: string;
	steps: readonly ConversationStep[];
	metadata?: Record<string, unknown>;
}

// ============================================================================
// Metric System Types
// ============================================================================

export type MetricScalar = number | boolean | string;

/**
 * Score domain: normalized [0, 1] values
 * Branded type to ensure type safety for normalized scores
 */
export type Score = number & { readonly __brand: 'Score' };

/**
 * Helper function to create a Score from a number
 * Validates that the value is in [0, 1] range
 */
export const toScore = (n: number): Score => {
	if (n < 0 || n > 1) {
		throw new Error(`Score must be in [0, 1] range, got ${n}`);
	}
	return n as Score;
};

/**
 * Output value type aligned with T
 * Maps TypeScript types to their string representations
 */
export type ValueTypeFor<T> =
	T extends number ? 'number' | 'ordinal'
	: T extends boolean ? 'boolean'
	: 'string';

export type MetricScope = 'single' | 'multi';

/**
 * Single target type for a container
 * Extracts the single target type based on container type
 */
export type SingleTargetFor<TContainer> =
	TContainer extends Conversation ? ConversationStep :
	TContainer extends DatasetItem ? DatasetItem :
	never;

/**
 * Base Metric Definition (passed around as a value)
 * All metric definitions extend this base interface
 */
export interface BaseMetricDef<T extends MetricScalar = MetricScalar> {
	name: string;
	description?: string;
	valueType: ValueTypeFor<T>;
	metadata?: Record<string, unknown>;
	// Normalization is owned by the metric definition
	normalization?: MetricNormalization<T, ScoringContext>;
}

// ============================================================================
// LLM-Based Metric Types
// ============================================================================

import type { LanguageModel } from 'ai';

/**
 * Language model provider type
 * Can be a direct instance or a factory function
 */
export type LanguageModelLike = LanguageModel;
export type ModelProvider = LanguageModelLike | (() => LanguageModelLike);

/**
 * Variables tuple for prompt templates
 */
export type VarsTuple = readonly string[];

/**
 * Prompt template with variable substitution support
 * Uses {{variable}} syntax for template variables
 */
export type PromptTemplate<TVars extends VarsTuple = readonly []> = {
	instruction: string; // Template with {{variable}} substitutions
	variables?: TVars; // Available substitution variables
	examples?: Array<{
		input: Record<TVars[number], unknown>;
		expectedOutput: string;
	}>;
};

/**
 * Shared fields for LLM-based metrics
 * Uses AI SDK's generateObject for structured outputs
 */
export interface LLMMetricFields<TRawValue extends MetricScalar = number, TVars extends VarsTuple = readonly []> {
	type: 'llm-based';
	// AI SDK provider: pass a LanguageModel instance or factory used for generation
	// e.g., openai('gpt-4.1') from '@ai-sdk/openai'
	provider: ModelProvider;
	prompt: PromptTemplate<TVars>;
	rubric?: {
		criteria: string;
		scale?: string;
		examples?: Array<{
			score: number;
			reasoning: string;
		}>;
	};
	postProcessing?: {
		normalize?: boolean;
		transform?: (rawOutput: string) => TRawValue;
	};
}

// ============================================================================
// Code-Based Metric Types
// ============================================================================

/**
 * Shared fields for code-based metrics
 * Computes metric values programmatically
 */
export interface CodeMetricFields<TRawValue extends MetricScalar = MetricScalar> {
	type: 'code-based';
	compute: (args: { data: unknown; metadata?: Record<string, unknown> }) => TRawValue;
	dependencies?: BaseMetricDef[];
	cacheable?: boolean;
}

// ============================================================================
// Single-Turn and Multi-Turn Metric Definitions
// ============================================================================

/**
 * Single-turn metric definition
 * Measures a single target (DatasetItem or ConversationStep)
 */
export interface SingleTurnMetricDef<TRawValue extends MetricScalar, TContainerData>
	extends BaseMetricDef<TRawValue> {
	scope: 'single';
	/**
	 * Prepares the selected target into a normalized payload suitable for execution.
	 * For DatasetItem/ConversationStep, the default shape should expose { input, output }.
	 * Implementations may return any shape required by the metric.
	 */
	preProcessor?: (selected: SingleTargetFor<TContainerData>) => Promise<unknown> | unknown;
}

/**
 * Multi-turn metric definition
 * Measures an entire Conversation
 */
export interface MultiTurnMetricDef<TRawValue extends MetricScalar, TContainer extends Conversation>
	extends BaseMetricDef<TRawValue> {
	scope: 'multi';
	/**
	 * Prepare a conversation for downstream execution (LLM or code).
	 * Should return a serializable payload containing exactly what the metric needs.
	 */
	preprocessContainer?: (container: TContainer) => Promise<unknown> | unknown;
	/**
	 * @deprecated Use preprocessContainer instead. This legacy field will be treated
	 * as the preprocessor during execution if provided.
	 */
	runOnContainer?: (container: TContainer) => Promise<unknown> | unknown;
}

/**
 * Single-turn metric variants (LLM or Code-based)
 */
export type SingleTurnMetricVariants<
	TRawValue extends MetricScalar,
	TContainerData,
	TVars extends VarsTuple = readonly []
> =
	| (SingleTurnMetricDef<TRawValue, TContainerData> & LLMMetricFields<TRawValue, TVars>)
	| (SingleTurnMetricDef<TRawValue, TContainerData> & CodeMetricFields<TRawValue>);

/**
 * Multi-turn metric variants (LLM or Code-based)
 */
export type MultiTurnMetricVariants<
	TRawValue extends MetricScalar,
	TVars extends VarsTuple = readonly []
> =
	| (MultiTurnMetricDef<TRawValue, Conversation> & LLMMetricFields<TRawValue, TVars>)
	| (MultiTurnMetricDef<TRawValue, Conversation> & CodeMetricFields<TRawValue>);

/**
 * Metric definition union type
 * Can be single-turn or multi-turn, LLM-based or code-based
 */
export type MetricDef<
	TRawValue extends MetricScalar = MetricScalar,
	TContainerData = unknown
> =
	| SingleTurnMetricVariants<TRawValue, TContainerData>
	| (TContainerData extends Conversation ? MultiTurnMetricVariants<TRawValue> : never);

/**
 * Any MetricDef for a container type
 */
export type MetricDefFor<TContainer> = MetricDef<MetricScalar, TContainer>;

/**
 * Runtime Metric (result of executing a MetricDef)
 * Contains the raw value and execution metadata
 */
export interface Metric<TRawValue extends MetricScalar = MetricScalar> {
	metricDef: MetricDef<TRawValue, unknown>; // Direct reference to the definition that produced this value
	value: TRawValue;
	confidence?: number; // For LLM metrics
	reasoning?: string; // For LLM metrics
	executionTime: number;
	timestamp: Date;
	metadata?: Record<string, unknown>;
}

// ============================================================================
// Normalization Types
// ============================================================================

/**
 * Normalization function type
 * Transforms a raw metric value to a Score [0, 1]
 */
export type NormalizeToScore<TRawValue extends MetricScalar = number, TContext = unknown> = (
	value: TRawValue,
	args: { context: TContext; metric: MetricDef<TRawValue, unknown> }
) => Score; // must return [0,1] Score

/**
 * Scoring context for normalization
 * Provides metadata needed for normalization algorithms
 */
export interface ScoringContext {
	direction?: 'higher' | 'lower';
	range?: { min: number; max: number };
	distribution?: { mean: number; stdDev: number };
	thresholds?: { pass: number; warn?: number };
	ordinalMap?: Record<string | number, number>;
	unit?: string;
	clip?: boolean;
	extra?: Record<string, unknown>;
}

/**
 * Normalizer specification
 * Discriminated union of all normalizer types
 */
export type NormalizerSpec<TRawValue extends MetricScalar = MetricScalar, TContext = unknown> =
	| { type: 'identity' }
	| { type: 'min-max'; min?: number; max?: number; clip?: boolean; direction?: 'higher' | 'lower' }
	| { type: 'z-score'; mean?: number; stdDev?: number; to?: '0-1' | '0-100'; clip?: boolean; direction?: 'higher' | 'lower' }
	| { type: 'threshold'; threshold: number; above?: number; below?: number }
	| { type: 'linear'; slope: number; intercept: number; clip?: [number, number]; direction?: 'higher' | 'lower' }
	| { type: 'ordinal-map'; map: Record<string | number, number> }
	| { type: 'custom'; normalize: NormalizeToScore<TRawValue, TContext> };

/**
 * Metric normalization configuration
 * Defines default normalizer and optional context resolver
 */
export interface MetricNormalization<TRawValue extends MetricScalar = MetricScalar, TContext = ScoringContext> {
	default: NormalizerSpec<TRawValue, TContext> | NormalizeToScore<TRawValue, TContext>;
	context?: TContext | ((args: { dataset: readonly unknown[]; rawValues: readonly TRawValue[] }) => Promise<TContext> | TContext);
}

// ============================================================================
// Scorer Types
// ============================================================================

/**
 * Scorer input definition
 * References a metric definition directly (value-based composition)
 */
export interface ScorerInput<
	M extends MetricDef<MetricScalar, unknown> = MetricDef<MetricScalar, unknown>,
	TContext = ScoringContext
> {
	metric: M; // Direct reference to the MetricDef being combined
	weight: number;
	// Optional override; metrics own normalization by default.
	// If provided, it must match the raw value type of the referenced metric.
	normalizerOverride?: M extends MetricDef<infer TRawValue, unknown>
		? NormalizerSpec<TRawValue, TContext> | NormalizeToScore<TRawValue, TContext>
		: never;
	required?: boolean; // default true
}

/**
 * Input scores type
 * Maps metric names to their normalized Score values
 */
export type InputScores<TInputs extends readonly ScorerInput[]> = {
	[K in TInputs[number] as K['metric']['name']]: Score;
};

/**
 * Scorer definition
 * Combines multiple normalized metrics into a single derived metric
 */
export interface Scorer<TInputs extends readonly ScorerInput[] = readonly ScorerInput[]> {
	name: string;
	description?: string;
	output: BaseMetricDef<number>;
	inputs: TInputs;
	normalizeWeights?: boolean; // default true
	combineScores?: (scores: InputScores<TInputs>) => Score; // Optional custom combiner over Scores
	fallbackScore?: Score;
	metadata?: Record<string, unknown>;
}

// ============================================================================
// Evaluator Types
// ============================================================================

/**
 * Single-turn run policy
 * Controls which targets single-turn metrics evaluate
 */
export type SingleTurnRunPolicy =
	| { run: 'all' }
	| { run: 'selectedSteps'; stepIndices: readonly number[] }
	| { run: 'selectedItems'; itemIndices: readonly number[] };

/**
 * Evaluation context
 * Provides execution context for evaluators
 */
export interface EvaluationContext {
	singleTurn?: SingleTurnRunPolicy;
	metadata?: Record<string, unknown>;
}

/**
 * Evaluator definition
 * Orchestrates metric execution and scoring
 */
export interface Evaluator<
	TContainer,
	TInputs extends readonly MetricDefFor<TContainer>[]
> {
	name: string;
	description?: string;
	metrics: TInputs; // May mix single-turn and multi-turn metric definitions
	scorer: Scorer; // Combine normalized results emitted by the listed metrics
	context?: EvaluationContext; // Applied to single-turn metrics only
}

// ============================================================================
// Aggregator Types
// ============================================================================

/**
 * Aggregator definition
 * Summarizes derived metric values across all data points
 */
export interface Aggregator {
	name: string;
	description?: string;
	metric: BaseMetricDef<number>; // Derived metric produced by a scorer
	aggregate: (values: readonly Score[]) => Score;
	metadata?: Record<string, unknown>;
}

// ============================================================================
// Report Types
// ============================================================================

/**
 * Per-target result
 * Contains raw and derived metrics for a single data point
 */
export interface PerTargetResult {
	targetId: string;
	rawMetrics: Metric[]; // each Metric carries its defining MetricDef
	derivedMetrics: Array<{
		definition: BaseMetricDef<number>;
		value: Score;
	}>;
}

/**
 * Aggregate summary
 * Statistical summary of a derived metric across all targets
 */
export interface AggregateSummary {
	metric: BaseMetricDef<number>;
	average: Score;
	percentile?: Record<number, number>;
	count: number;
}

/**
 * Evaluation report
 * Final output containing per-target results and aggregate summaries
 */
export interface EvaluationReport {
	runId: string;
	timestamp: Date;
	perTargetResults: PerTargetResult[];
	aggregateSummaries: AggregateSummary[];
	metadata: Record<string, unknown>;
}

// ============================================================================
// Main Container Type
// ============================================================================

/**
 * Tally container
 * Main evaluation container that orchestrates the entire evaluation flow
 */
export interface Tally<TContainer> {
	data: readonly TContainer[];
	evaluators: readonly Evaluator<
		TContainer,
		readonly MetricDefFor<TContainer>[]
	>[];
	aggregators: readonly Aggregator[];
	run(): Promise<EvaluationReport>;
}

