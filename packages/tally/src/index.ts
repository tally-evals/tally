/**
 * Tally - A TypeScript evaluation framework for running model evaluations
 *
 * This framework provides tools for:
 * - Datasets and Conversations (input data)
 * - Evaluators (with Evals - new API)
 * - Metrics (Boolean, Number, Ordinal/Enum)
 * - TallyRunArtifact (stored run artifact output with defs + step-indexed results)
 */

// ============================================================================
// Core Types
// ============================================================================

export type {
  // Data types
  DatasetItem,
  Conversation,
  ConversationStep,
  SingleTurnContainer,
  MultiTurnContainer,
  MetricContainer,
  // Metric system
  MetricScalar,
  Score,
  ValueTypeFor,
  MetricScope,
  SingleTargetFor,
  BaseMetricDef,
  LLMMetricFields,
  CodeMetricFields,
  SingleTurnMetricDef,
  MultiTurnMetricDef,
  MetricDef,
  MetricDefFor,
  Metric,
  // Normalization types
  NormalizeToScore,
  NumericNormalizationContext,
  BooleanNormalizationContext,
  OrdinalNormalizationContext,
  NormalizationContextFor,
  NormalizerSpec,
  MetricNormalization,
  NormalizationInfo,
  NormalizerSpecSnap,
  MetricNormalizationSnap,
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
  // Eval context types
  SingleTurnRunPolicy,
  EvaluationContext,
  // Core result types (unified)
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
  RunDefs,
  // Artifact & Report
  TallyRunArtifact,
  TallyRunReport,
  TallyRunOptions,
  // Main container
  Tally,
} from './core/types';

export { toScore } from './core/types';

// ============================================================================
// Eval API (New - Primary API)
// ============================================================================

export {
  defineSingleTurnEval,
  defineMultiTurnEval,
  defineScorerEval,
  runAllTargets,
  runSelectedSteps,
  runSelectedItems,
  booleanVerdict,
  thresholdVerdict,
  rangeVerdict,
  ordinalVerdict,
  customVerdict,
} from './evals';

export type {
  Eval,
  SingleTurnEval,
  MultiTurnEval,
  ScorerEval,
  VerdictPolicy,
  VerdictPolicyFor,
  AutoNormalizer,
} from './evals';

// ============================================================================
// Tally Container
// ============================================================================

export { TallyContainer, createTally } from './core/tally';
export type { TallyContainer as TallyContainerType } from './core/tally';

// ============================================================================
// SDK/Test Views
// ============================================================================

export { createTargetRunView, TargetRunViewImpl } from './view/targetRunView';
export type {
  TargetRunView,
  StepResults,
  StepResultsWithIndex,
  ConversationResults,
  SummaryResults,
} from '@tally-evals/core';

// ============================================================================
// Factory APIs
// ============================================================================

export {
  defineBaseMetric,
  withNormalization,
  withMetadata,
  createSingleTurnCode,
  createSingleTurnLLM,
  createMultiTurnCode,
  createMultiTurnLLM,
  defineInput,
  defineScorer,
} from './core/factory';

// ============================================================================
// Evaluation Context Helpers
// ============================================================================

export {
  runAllTargets as runAllTargetsLegacy,
  runSpecificSteps,
  runSpecificItems,
  createEvaluationContext,
} from './core/evaluators/helpers';

export {
  selectConversationTargets,
  selectDatasetTargets,
  resolveRunPolicy,
  validateStepIndices,
  validateItemIndices,
} from './core/evaluators/context';
export type { TargetSelectionResult } from './core/evaluators/context';

// ============================================================================
// Execution (Advanced - typically used internally)
// ============================================================================

export {
  runSingleTurnMetric,
  runSingleTurnMetrics,
} from './core/execution/runSingleTurn';
export type { RunSingleTurnOptions } from './core/execution/runSingleTurn';

export {
  runMultiTurnMetric,
  runMultiTurnMetrics,
} from './core/execution/runMultiTurn';
export type { RunMultiTurnOptions } from './core/execution/runMultiTurn';

export { MemoryCache } from './core/execution/cache/memoryCache';
export type {
  CacheEntry,
  CacheStats,
} from './core/execution/cache/memoryCache';

// ============================================================================
// Aggregators
// ============================================================================

export {
  // Custom aggregator definitions (define*)
  defineNumericAggregator,
  defineBooleanAggregator,
  defineCategoricalAggregator,
  // Prebuilt numeric aggregators (create*)
  createMeanAggregator,
  createPercentileAggregator,
  createThresholdAggregator,
  // Prebuilt boolean aggregators (create*)
  createTrueRateAggregator,
  createFalseRateAggregator,
  // Prebuilt categorical aggregators (create*)
  createDistributionAggregator,
  createModeAggregator,
  // Default aggregators
  DEFAULT_AGGREGATORS,
  DEFAULT_NUMERIC_AGGREGATORS,
  getDefaultAggregators,
} from './aggregators';

export type {
  // Custom aggregator definition args
  DefineNumericAggregatorArgs,
  DefineBooleanAggregatorArgs,
  DefineCategoricalAggregatorArgs,
  // Prebuilt aggregator options
  MeanAggregatorOptions,
  PercentileAggregatorOptions,
  ThresholdAggregatorOptions,
  TrueRateAggregatorOptions,
  DistributionAggregatorOptions,
} from './aggregators';

// ============================================================================
// Utilities
// ============================================================================

export { generateId } from './utils/ids';
export * from './utils/guards';
export * from './utils/text';
export * from './utils/time';
export { formatReportAsTables } from './utils/reportFormatter';
