/**
 * Core type definitions for the Tally evaluation framework
 *
 * This file re-exports all types from @tally-evals/core for backward compatibility.
 * The canonical type definitions now live in the core package.
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
  // Report types
  TargetVerdict,
  PerTargetResult,
  Aggregations,
  VerdictSummary,
  AggregateSummary,
  EvalSummary,
  EvaluationReport,
  // Tally container
  Tally,
} from '@tally-evals/core';

// Re-export toScore function
export { toScore } from '@tally-evals/core';
