/**
 * Core type definitions for the Tally evaluation framework
 *
 * This file re-exports core types from @tally-evals/core.
 */

// Re-export everything from @tally-evals/core
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
  ScoringContext,
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
  Evaluator,
  // Run artifact types (canonical reporting schema)
  MetricName,
  EvalName,
  RunId,
  ConversationId,
  Verdict,
  MetricScalarOrNull,
  Measurement,
  VerdictPolicyInfo,
  EvalOutcome,
  StepEvalResult,
  ConversationEvalResult,
  SingleTurnEvalSeries,
  ConversationResult,
  MetricDefSnap,
  EvalDefSnap,
  RunDefs,
  EvalSummarySnap,
  Summaries,
  TallyRunArtifact,
  TargetRunView,
  TallyRunReport,
  // Tally container
  Tally,
} from '@tally-evals/core';

// Re-export toScore function
export { toScore } from '@tally-evals/core';
