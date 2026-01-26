/**
 * Core type definitions for the Tally evaluation framework
 *
 * This file re-exports core types from @tally/core.
 */

// Re-export everything from @tally/core
export type {
  // Primitives
  MetricScalar,
  Score,
  ValueTypeFor,
  MetricScope,
  DatasetItem,
  // Conversation types
  Conversation,
  ConversationStep,
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
  // Normalization types
  NumericNormalizationContext,
  BooleanNormalizationContext,
  OrdinalNormalizationContext,
  NormalizationContextFor,
  MetricInfo,
  NormalizeToScore,
  NormalizerSpec,
  MetricNormalization,
  // Scorer types
  ScorerInput,
  InputScores,
  Scorer,
  // Aggregator types
  NumericAggregatorDef,
  BooleanAggregatorDef,
  CategoricalAggregatorDef,
  AggregatorDef,
  CompatibleAggregator,
  Aggregator,
  // Evaluator types
  SingleTurnRunPolicy,
  EvaluationContext,
  VerdictPolicyFor,
  VerdictPolicy,
  AutoNormalizer,
  SingleTurnEval,
  MultiTurnEval,
  ScorerEval,
  Eval,
  // Core result types (unified)
  MetricName,
  EvalName,
  ScorerName,
  RunId,
  ConversationId,
  Verdict,
  MetricScalarOrNull,
  NormalizerSpecSnap,
  NormalizationInfo,
  MetricNormalizationSnap,
  VerdictPolicyInfo,
  Measurement,
  EvalOutcome,
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
  // Artifact & Report
  TallyRunArtifact,
  TargetRunView,
  TallyRunReport,
  TallyRunOptions,
  // Tally container
  Tally,
} from '@tally-evals/core';

// Re-export toScore function
export { toScore } from '@tally-evals/core';
