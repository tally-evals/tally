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
  NumericNormalizationContext,
  BooleanNormalizationContext,
  OrdinalNormalizationContext,
  NormalizationContextFor,
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
} from './evaluators';

// ============================================================================
// Core result types (unified)
// ============================================================================

export type {
  // Primitives
  MetricName,
  EvalName,
  ScorerName,
  RunId,
  ConversationId,
  Verdict,
  MetricScalarOrNull,

  // Normalization info
  NormalizerSpecSnap,
  NormalizationInfo,
  MetricNormalizationSnap,

  // Verdict policy
  VerdictPolicyInfo,

  // Measurement & Outcome
  Measurement,
  EvalOutcome,

  // Result records
  StepEvalResult,
  SingleTurnEvalSeries,
  ConversationEvalResult,
  ConversationResult,

  // Type extraction utilities
  ExtractEvalName,
  ExtractValueType,
  ExtractEvalKind,
  FilterByKind,
  EvalNamesOfKind,
  HasEvalsOfKind,
  ExtractVerdictPolicy,
  ExtractNormalizationContext,

  // Mapped result types
  SingleTurnResults,
  MultiTurnResults,
  ScorerResults,

  // View result types
  StepResults,
  StepResultsWithIndex,
  ConversationResults,
  SummaryResults,

  // Aggregations
  AggregationValue,
  ExtractAggregatorNames,
  ExtractEvalAggregatorNames,
  DefaultNumericAggregatorNames,
  DefaultBooleanAggregatorNames,
  DefaultCategoricalAggregatorNames,
  AggregationResultFor,
  ScoreAggregations,
  RawAggregations,

  // Summaries
  VerdictSummary,
  EvalSummary,
  Summaries,

  // Definition snapshots
  MetricDefSnap,
  EvalDefSnap,
  ScorerCombineKind,
  ScorerInputSnap,
  ScorerDefSnap,
  RunDefs,
} from './results';

// ============================================================================
// Run artifact (serialization)
// ============================================================================

export type { TallyRunArtifact } from './runArtifact';

// ============================================================================
// SDK report + view types
// ============================================================================

export type { TargetRunView } from './runView';
export type { TallyRunReport } from './runReport';

// ============================================================================
// Tally container type
// ============================================================================

export type { Tally, TallyRunOptions } from './tally';
