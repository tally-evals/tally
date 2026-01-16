/**
 * Shared types re-exported from core
 */

// ============================================================================
// Primitives (foundational types with no dependencies)
// ============================================================================

export type {
  MetricScalar,
  Score,
  ValueTypeFor,
  MetricScope,
  DatasetItem,
} from './primitives';

export { toScore } from './primitives';

// ============================================================================
// Message types
// ============================================================================

export type { ModelMessage } from './messages';

// ============================================================================
// Conversation types
// ============================================================================

export type { Conversation, ConversationStep } from './conversation';

// ============================================================================
// Trajectory types
// ============================================================================

export type { StepTrace, TrajectoryStopReason } from './stepTrace';
export type { TrajectoryMeta } from './trajectoryMeta';

// ============================================================================
// Run metadata types
// ============================================================================

export type { TrajectoryRunMeta, TallyRunMeta } from './runs';

// ============================================================================
// Tool call types
// ============================================================================

export type { ExtractedToolCall, ExtractedToolResult } from './toolCalls';

// ============================================================================
// Normalization types
// ============================================================================

export type {
  ScoringContext,
  MetricInfo,
  NormalizeToScore,
  NormalizerSpec,
  MetricNormalization,
} from './normalization';

// ============================================================================
// Metric types
// ============================================================================

export type {
  // Container types
  SingleTurnContainer,
  MultiTurnContainer,
  MetricContainer,
  SingleTargetFor,

  // LLM types
  LanguageModelLike,
  ModelProvider,
  VarsTuple,
  PromptTemplate,
  LLMMetricFields,
  CodeMetricFields,

  // Metric definition types
  BaseMetricDef,
  SingleTurnMetricDef,
  MultiTurnMetricDef,
  SingleTurnMetricVariants,
  MultiTurnMetricVariants,
  MetricDef,
  MetricDefFor,
  AnyMetricDefFor,
  Metric,

  // Aggregator types
  NumericAggregatorDef,
  BooleanAggregatorDef,
  CategoricalAggregatorDef,
  AggregatorDef,
  CompatibleAggregator,
  Aggregator,
} from './metrics';

// ============================================================================
// Scorer types
// ============================================================================

export type { ScorerInput, InputScores, Scorer } from './scorers';

// ============================================================================
// Evaluator types
// ============================================================================

export type {
  // Run policy types
  SingleTurnRunPolicy,
  EvaluationContext,

  // Verdict types
  VerdictPolicyFor,
  VerdictPolicy,
  AutoNormalizer,

  // Eval types
  SingleTurnEval,
  MultiTurnEval,
  ScorerEval,
  Eval,

  // Evaluator type
  Evaluator,
} from './evaluators';

// ============================================================================
// Report types
// ============================================================================

export type {
  TargetVerdict,
  PerTargetResult,
  Aggregations,
  VerdictSummary,
  AggregateSummary,
  EvalSummary,
  EvaluationReport,
} from './report';

// ============================================================================
// Tally container type
// ============================================================================

export type { Tally } from './tally';
