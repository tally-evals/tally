/**
 * Core Metric Type Definitions
 *
 * Foundational types for the Tally evaluation framework's metric system.
 * These types define how metrics are specified, measured, and processed.
 */

import type { LanguageModel } from 'ai';
import type { Conversation, ConversationStep } from './conversation';
import type {
  MetricNormalization,
  NormalizationContextFor,
} from './normalization';
import type {
  MetricScalar,
  ValueTypeFor,
  DatasetItem,
} from './primitives';

// Re-export primitives for convenience
export type {
  MetricScalar,
  Score,
  ValueTypeFor,
  MetricScope,
  DatasetItem,
} from './primitives';
export { toScore } from './primitives';

// ============================================================================
// Container Types
// ============================================================================

/**
 * Valid container types for single-turn metrics.
 *
 * Single-turn metrics evaluate individual items:
 * - `ConversationStep` - One turn in a multi-turn conversation
 * - `DatasetItem` - A standalone prompt/completion pair
 */
export type SingleTurnContainer = ConversationStep | DatasetItem;

/**
 * Valid container types for multi-turn metrics.
 *
 * Multi-turn metrics evaluate entire conversations.
 */
export type MultiTurnContainer = Conversation;

/**
 * Union of all valid container types for metrics.
 */
export type MetricContainer = SingleTurnContainer | MultiTurnContainer;

/**
 * Extracts the single evaluation target from a container type.
 *
 * @typeParam TContainer - The container type
 */
export type SingleTargetFor<TContainer> = TContainer extends Conversation
  ? ConversationStep
  : TContainer extends DatasetItem
    ? DatasetItem
    : never;

// ============================================================================
// LLM-Based Metric Types
// ============================================================================

/**
 * AI SDK language model type.
 */
export type LanguageModelLike = LanguageModel;

/**
 * Language model provider - direct instance or factory function.
 *
 * @example
 * ```typescript
 * import { openai } from '@ai-sdk/openai';
 * const provider: ModelProvider = openai('gpt-4');
 * ```
 */
export type ModelProvider = LanguageModelLike | (() => LanguageModelLike);

/**
 * Tuple of variable names for prompt templates.
 */
export type VarsTuple = readonly string[];

/**
 * Prompt template with variable substitution support.
 *
 * Uses `{{variable}}` syntax for template variables.
 *
 * @typeParam TPromptVars - Tuple of available variable names
 */
export type PromptTemplate<TPromptVars extends VarsTuple = readonly []> = {
  /** Template string with {{variable}} placeholders */
  instruction: string;
  /** Available substitution variable names */
  variables?: TPromptVars;
  /** Few-shot examples for the LLM */
  examples?: Array<{
    input: Record<TPromptVars[number], unknown>;
    expectedOutput: string;
  }>;
};

/**
 * Configuration fields for LLM-based metrics.
 *
 * Uses AI SDK's `generateObject` for structured outputs.
 *
 * @typeParam TMetricValue - The metric value type
 * @typeParam TPromptVars - Tuple of prompt template variable names
 */
export interface LLMMetricFields<
  TMetricValue extends MetricScalar = number,
  TPromptVars extends VarsTuple = readonly [],
> {
  /** Discriminator for metric implementation type */
  type: 'llm-based';
  /**
   * AI SDK provider instance or factory.
   * @example openai('gpt-4') from '@ai-sdk/openai'
   */
  provider: ModelProvider;
  /** Prompt template for LLM evaluation */
  prompt: PromptTemplate<TPromptVars>;
  /** Optional rubric for consistent LLM scoring */
  rubric?: {
    criteria: string;
    scale?: string;
    examples?: Array<{
      score: number;
      reasoning: string;
    }>;
  };
  /** Optional post-processing of LLM output */
  postProcessing?: {
    normalize?: boolean;
    transform?: (rawOutput: string) => TMetricValue;
  };
}

// ============================================================================
// Code-Based Metric Types
// ============================================================================

/**
 * Configuration fields for code-based metrics.
 *
 * Computes metric values programmatically using custom logic.
 *
 * @typeParam TMetricValue - The metric value type
 */
export interface CodeMetricFields<
  TMetricValue extends MetricScalar = MetricScalar,
> {
  /** Discriminator for metric implementation type */
  type: 'code-based';
  /** Function that computes the metric value from input data */
  compute: (args: {
    data: unknown;
    metadata?: Record<string, unknown>;
  }) => TMetricValue;
  /** Other metrics this metric depends on */
  dependencies?: BaseMetricDef[];
  /** Whether results can be cached */
  cacheable?: boolean;
}

// ============================================================================
// Metric Definitions
// ============================================================================

/**
 * Base metric definition shared by all metric types.
 *
 * @typeParam TMetricValue - The value type this metric produces (number, boolean, or string)
 *
 * @example
 * ```typescript
 * const base: BaseMetricDef<number> = {
 *   name: 'relevance',
 *   valueType: 'number',
 *   description: 'Measures answer relevance',
 * };
 * ```
 */
export interface BaseMetricDef<TMetricValue extends MetricScalar = MetricScalar> {
  /** Unique metric name */
  name: string;
  /** Human-readable description */
  description?: string;
  /** The value type this metric produces */
  valueType: ValueTypeFor<TMetricValue>;
  /** Custom metadata */
  metadata?: Record<string, unknown>;
  /** Normalization configuration for converting to Score */
  normalization?: MetricNormalization<TMetricValue, NormalizationContextFor<TMetricValue>>;
}

/**
 * Single-turn metric definition.
 *
 * Evaluates individual items (DatasetItem or ConversationStep).
 *
 * @typeParam TMetricValue - The value type this metric produces
 * @typeParam TContainer - The container type (SingleTurnContainer)
 */
export interface SingleTurnMetricDef<
  TMetricValue extends MetricScalar,
  TContainer extends SingleTurnContainer = SingleTurnContainer,
> extends BaseMetricDef<TMetricValue> {
  /** Metric scope discriminator */
  scope: 'single';
  /**
   * Prepares the selected target into a normalized payload for execution.
   * Default shape exposes `{ input, output }`.
   */
  preProcessor?: (
    selected: SingleTargetFor<TContainer>,
  ) => Promise<unknown> | unknown;
  /** Aggregators for combining results across items */
  aggregators?: Aggregator<TMetricValue, TContainer>[];
}

/**
 * Multi-turn metric definition.
 *
 * Evaluates entire conversations.
 *
 * @typeParam TMetricValue - The value type this metric produces
 * @typeParam TContainer - The container type (MultiTurnContainer)
 */
export interface MultiTurnMetricDef<
  TMetricValue extends MetricScalar,
  TContainer extends MultiTurnContainer = MultiTurnContainer,
> extends BaseMetricDef<TMetricValue> {
  /** Metric scope discriminator */
  scope: 'multi';
  /**
   * Prepares a conversation for downstream execution (LLM or code).
   * Returns a serializable payload containing what the metric needs.
   */
  preprocessContainer?: (container: TContainer) => Promise<unknown> | unknown;
  /**
   * @deprecated Use preprocessContainer instead.
   */
  runOnContainer?: (container: TContainer) => Promise<unknown> | unknown;
}

/**
 * Single-turn metric variants (LLM or Code-based).
 *
 * @typeParam TMetricValue - The value type this metric produces
 * @typeParam TContainer - The container type
 * @typeParam TPromptVars - Prompt template variables (for LLM metrics)
 */
export type SingleTurnMetricVariants<
  TMetricValue extends MetricScalar,
  TContainer extends SingleTurnContainer = SingleTurnContainer,
  TPromptVars extends VarsTuple = readonly [],
> =
  | (SingleTurnMetricDef<TMetricValue, TContainer> &
      LLMMetricFields<TMetricValue, TPromptVars>)
  | (SingleTurnMetricDef<TMetricValue, TContainer> &
      CodeMetricFields<TMetricValue>);

/**
 * Multi-turn metric variants (LLM or Code-based).
 *
 * @typeParam TMetricValue - The value type this metric produces
 * @typeParam TContainer - The container type
 * @typeParam TPromptVars - Prompt template variables (for LLM metrics)
 */
export type MultiTurnMetricVariants<
  TMetricValue extends MetricScalar,
  TContainer extends MultiTurnContainer = MultiTurnContainer,
  TPromptVars extends VarsTuple = readonly [],
> =
  | (MultiTurnMetricDef<TMetricValue, TContainer> &
      LLMMetricFields<TMetricValue, TPromptVars>)
  | (MultiTurnMetricDef<TMetricValue, TContainer> & CodeMetricFields<TMetricValue>);

/**
 * Complete metric definition union type.
 *
 * Can be single-turn or multi-turn, LLM-based or code-based.
 *
 * @typeParam TMetricValue - The value type this metric produces
 * @typeParam TContainer - The container type
 */
export type MetricDef<
  TMetricValue extends MetricScalar = MetricScalar,
  TContainer extends MetricContainer = MetricContainer,
> =
  | SingleTurnMetricVariants<
      TMetricValue,
      TContainer extends SingleTurnContainer
        ? TContainer
        : SingleTurnContainer
    >
  | (TContainer extends MultiTurnContainer
      ? MultiTurnMetricVariants<TMetricValue, TContainer>
      : never);

/**
 * Shorthand for any MetricDef compatible with a container type.
 *
 * @typeParam TContainer - The container type
 */
export type MetricDefFor<TContainer extends MetricContainer> =
  AnyMetricDefFor<TContainer>;

/**
 * Accepts any MetricDef for a container type, regardless of value type.
 *
 * Uses MetricScalar union to maintain type safety while accepting
 * all valid metric value types.
 *
 * @typeParam TContainer - The container type
 */
export type AnyMetricDefFor<TContainer extends MetricContainer> =
  TContainer extends SingleTurnContainer
    ? SingleTurnMetricDef<MetricScalar, TContainer>
    : TContainer extends MultiTurnContainer
      ? MultiTurnMetricDef<MetricScalar, TContainer>
      : SingleTurnMetricDef<MetricScalar, SingleTurnContainer> | MultiTurnMetricDef<MetricScalar, MultiTurnContainer>;

/**
 * Runtime metric result.
 *
 * Contains the computed value and execution metadata.
 *
 * @typeParam TMetricValue - The value type this metric produces
 */
export interface Metric<TMetricValue extends MetricScalar = MetricScalar> {
  /** Reference to the definition that produced this value */
  metricDef: MetricDef<TMetricValue, MetricContainer>;
  /** The computed metric value */
  value: TMetricValue;
  /** Confidence level (for LLM metrics) */
  confidence?: number;
  /** Reasoning explanation (for LLM metrics) */
  reasoning?: string;
  /** Execution time in milliseconds */
  executionTime: number;
  /** When the metric was computed */
  timestamp: Date;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Aggregator Types (Discriminated Union)
// ============================================================================

/**
 * Base aggregator fields shared by all aggregator types.
 *
 * @typeParam TName - Literal string type for aggregator name (enables type-safe report access)
 */
interface BaseAggregatorDef<TName extends string = string> {
  /** Aggregator name (preserved as literal type for type-safe reports) */
  readonly name: TName;
  /** Human-readable description */
  description?: string;
  /** Custom metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Numeric aggregator - operates on number arrays.
 *
 * Used for scores (always) and numeric raw values.
 * Examples: Mean, Percentile, Threshold, Min, Max, StdDev
 *
 * @typeParam TName - Literal string type for aggregator name
 */
export interface NumericAggregatorDef<TName extends string = string> extends BaseAggregatorDef<TName> {
  readonly kind: 'numeric';
  /** Aggregation function */
  aggregate: (values: readonly number[]) => number;
}

/**
 * Boolean aggregator - operates on boolean arrays.
 *
 * Used for boolean raw values.
 * Examples: TrueRate, FalseRate
 *
 * @typeParam TName - Literal string type for aggregator name
 */
export interface BooleanAggregatorDef<TName extends string = string> extends BaseAggregatorDef<TName> {
  readonly kind: 'boolean';
  /** Aggregation function returning a rate (0-1) */
  aggregate: (values: readonly boolean[]) => number;
}

/**
 * Categorical aggregator - operates on string arrays.
 *
 * Used for string/ordinal raw values.
 * Examples: Distribution, Mode
 *
 * @typeParam TName - Literal string type for aggregator name
 */
export interface CategoricalAggregatorDef<TName extends string = string> extends BaseAggregatorDef<TName> {
  readonly kind: 'categorical';
  /** Aggregation function returning category counts/frequencies */
  aggregate: (values: readonly string[]) => Record<string, number>;
}

/**
 * Union of all aggregator types (discriminated by `kind`).
 *
 * @typeParam TName - Literal string type for aggregator name
 */
export type AggregatorDef<TName extends string = string> =
  | NumericAggregatorDef<TName>
  | BooleanAggregatorDef<TName>
  | CategoricalAggregatorDef<TName>;

/**
 * Maps metric value type to compatible aggregator types.
 *
 * - `number` metrics: Numeric aggregators only
 * - `boolean` metrics: Numeric (for scores) + Boolean (for raw values)
 * - `string` metrics: Numeric (for scores) + Categorical (for raw values)
 *
 * @typeParam TMetricValue - The metric value type
 * @typeParam TName - Literal string type for aggregator name
 */
export type CompatibleAggregator<
  TMetricValue extends MetricScalar,
  TName extends string = string,
> = TMetricValue extends number
  ? NumericAggregatorDef<TName>
  : TMetricValue extends boolean
    ? NumericAggregatorDef<TName> | BooleanAggregatorDef<TName>
    : TMetricValue extends string
      ? NumericAggregatorDef<TName> | CategoricalAggregatorDef<TName>
      : never;

/**
 * Metric-bound aggregator.
 *
 * Links an aggregator to a specific metric for result tracking.
 *
 * @typeParam TMetricValue - The metric value type
 * @typeParam TContainer - The container type
 * @typeParam TName - Literal string type for aggregator name
 */
export type Aggregator<
  TMetricValue extends MetricScalar,
  TContainer extends SingleTurnContainer,
  TName extends string = string,
> = CompatibleAggregator<TMetricValue, TName> & {
  metric: SingleTurnMetricDef<TMetricValue, TContainer>;
};
