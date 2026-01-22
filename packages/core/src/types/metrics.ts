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
 * Valid container types for single-turn metrics
 * Single-turn metrics measure individual steps or items
 */
export type SingleTurnContainer = ConversationStep | DatasetItem;

/**
 * Valid container types for multi-turn metrics
 * Multi-turn metrics measure entire conversations
 */
export type MultiTurnContainer = Conversation;

/**
 * Valid container types for metrics
 * Union of all possible container types
 */
export type MetricContainer = SingleTurnContainer | MultiTurnContainer;

/**
 * Single target type for a container
 * Extracts the single target type based on container type
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
export interface LLMMetricFields<
  TRawValue extends MetricScalar = number,
  TVars extends VarsTuple = readonly [],
> {
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
export interface CodeMetricFields<
  TRawValue extends MetricScalar = MetricScalar,
> {
  type: 'code-based';
  compute: (args: {
    data: unknown;
    metadata?: Record<string, unknown>;
  }) => TRawValue;
  dependencies?: BaseMetricDef[];
  cacheable?: boolean;
}

// ============================================================================
// Metric Definitions
// ============================================================================

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
  normalization?: MetricNormalization<T, NormalizationContextFor<T>>;
}

/**
 * Single-turn metric definition
 * Measures a single target (DatasetItem or ConversationStep)
 */
export interface SingleTurnMetricDef<
  TRawValue extends MetricScalar,
  TContainerData extends SingleTurnContainer = SingleTurnContainer,
> extends BaseMetricDef<TRawValue> {
  scope: 'single';
  /**
   * Prepares the selected target into a normalized payload suitable for execution.
   * For DatasetItem/ConversationStep, the default shape should expose { input, output }.
   * Implementations may return any shape required by the metric.
   */
  preProcessor?: (
    selected: SingleTargetFor<TContainerData>,
  ) => Promise<unknown> | unknown;
  aggregators?: Aggregator<TRawValue, TContainerData>[];
}

/**
 * Multi-turn metric definition
 * Measures an entire Conversation
 */
export interface MultiTurnMetricDef<
  TRawValue extends MetricScalar,
  TContainer extends MultiTurnContainer = MultiTurnContainer,
> extends BaseMetricDef<TRawValue> {
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
  TContainerData extends SingleTurnContainer = SingleTurnContainer,
  TVars extends VarsTuple = readonly [],
> =
  | (SingleTurnMetricDef<TRawValue, TContainerData> &
      LLMMetricFields<TRawValue, TVars>)
  | (SingleTurnMetricDef<TRawValue, TContainerData> &
      CodeMetricFields<TRawValue>);

/**
 * Multi-turn metric variants (LLM or Code-based)
 */
export type MultiTurnMetricVariants<
  TRawValue extends MetricScalar,
  TContainer extends MultiTurnContainer = MultiTurnContainer,
  TVars extends VarsTuple = readonly [],
> =
  | (MultiTurnMetricDef<TRawValue, TContainer> &
      LLMMetricFields<TRawValue, TVars>)
  | (MultiTurnMetricDef<TRawValue, TContainer> & CodeMetricFields<TRawValue>);

/**
 * Metric definition union type
 * Can be single-turn or multi-turn, LLM-based or code-based
 */
export type MetricDef<
  TRawValue extends MetricScalar = MetricScalar,
  TContainerData extends MetricContainer = MetricContainer,
> =
  | SingleTurnMetricVariants<
      TRawValue,
      TContainerData extends SingleTurnContainer
        ? TContainerData
        : SingleTurnContainer
    >
  | (TContainerData extends MultiTurnContainer
      ? MultiTurnMetricVariants<TRawValue, TContainerData>
      : never);

/**
 * Any MetricDef for a container type
 */
export type MetricDefFor<TContainer extends MetricContainer> =
  AnyMetricDefFor<TContainer>;

/**
 * Accepts any MetricDef for a container type, regardless of TRawValue
 * Uses MetricScalar (number | boolean | string) to maintain type safety
 * while accepting all valid metric value types
 */
export type AnyMetricDefFor<TContainer extends MetricContainer> =
  TContainer extends SingleTurnContainer
    ? SingleTurnMetricDef<MetricScalar, TContainer>
    : TContainer extends MultiTurnContainer
      ? MultiTurnMetricDef<MetricScalar, TContainer>
      : SingleTurnMetricDef<MetricScalar, SingleTurnContainer> | MultiTurnMetricDef<MetricScalar, MultiTurnContainer>;

/**
 * Runtime Metric (result of executing a MetricDef)
 * Contains the raw value and execution metadata
 */
export interface Metric<TRawValue extends MetricScalar = MetricScalar> {
  metricDef: MetricDef<TRawValue, MetricContainer>; // Direct reference to the definition that produced this value
  value: TRawValue;
  confidence?: number; // For LLM metrics
  reasoning?: string; // For LLM metrics
  executionTime: number;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Aggregator Types (Discriminated Union)
// ============================================================================

/**
 * Base aggregator fields shared by all aggregator types
 */
interface BaseAggregatorDef {
  name: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Numeric aggregator - operates on number arrays
 * Used for: scores (always), numeric raw values
 * Examples: Mean, Percentile, Threshold, Min, Max, StdDev
 */
export interface NumericAggregatorDef extends BaseAggregatorDef {
  readonly kind: 'numeric';
  aggregate: (values: readonly number[]) => number;
}

/**
 * Boolean aggregator - operates on boolean arrays
 * Used for: boolean raw values
 * Examples: TrueRate, FalseRate
 */
export interface BooleanAggregatorDef extends BaseAggregatorDef {
  readonly kind: 'boolean';
  aggregate: (values: readonly boolean[]) => number;
}

/**
 * Categorical aggregator - operates on string arrays
 * Used for: string/ordinal raw values
 * Examples: Distribution, Mode
 */
export interface CategoricalAggregatorDef extends BaseAggregatorDef {
  readonly kind: 'categorical';
  aggregate: (values: readonly string[]) => Record<string, number>;
}

/**
 * Union of all aggregator types (discriminated by `kind`)
 */
export type AggregatorDef =
  | NumericAggregatorDef
  | BooleanAggregatorDef
  | CategoricalAggregatorDef;

/**
 * Maps metric value type to compatible aggregator types
 *
 * Logic:
 * - Numeric aggregators always work on normalized scores (scores are numbers)
 * - For raw values, aggregator must match the metric's value type
 *
 * Result:
 * - number metrics: Only numeric aggregators (raw values are numbers)
 * - boolean metrics: Numeric (for scores) + Boolean (for raw values)
 * - string metrics: Numeric (for scores) + Categorical (for raw values)
 */
export type CompatibleAggregator<T extends MetricScalar> = T extends number
  ? NumericAggregatorDef
  : T extends boolean
    ? NumericAggregatorDef | BooleanAggregatorDef
    : T extends string
      ? NumericAggregatorDef | CategoricalAggregatorDef
      : never;

/**
 * Metric-bound aggregator
 * Links an aggregator to a specific metric for tracking
 */
export type Aggregator<
  T extends MetricScalar,
  TContainer extends SingleTurnContainer,
> = CompatibleAggregator<T> & {
  metric: SingleTurnMetricDef<T, TContainer>;
};
