/**
 * Tally - A TypeScript evaluation framework for running model evaluations
 *
 * This framework provides tools for:
 * - Datasets and Conversations (input data)
 * - Evaluators (with Evals - new API)
 * - Metrics (Boolean, Number, Ordinal/Enum)
 * - EvaluationReport (final output with built-in aggregations)
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
  ScoringContext,
  NormalizerSpec,
  MetricNormalization,

  // Scorer types
  ScorerInput,
  InputScores,
  Scorer,

  // Aggregator types
  Aggregator,

  // Evaluator types (REFACTORED - now accepts evals)
  SingleTurnRunPolicy,
  EvaluationContext,
  Evaluator,

  // Report types (ENHANCED)
  TargetVerdict,
  PerTargetResult,
  BuiltInAggregations,
  AggregateSummary,
  EvaluationReport,

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
// Builders
// ============================================================================

export { MetricDefBuilder } from './core/builders/MetricDefBuilder';
export { ScorerBuilder } from './core/builders/ScorerBuilder';

// ============================================================================
// Factory APIs (preferred over builders)
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
  createEvaluator,
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
// Utilities
// ============================================================================

export { generateId } from './utils/ids';
export * from './utils/guards';
export * from './utils/text';
export * from './utils/time';
export { formatReportAsTables } from './utils/reportFormatter';

// ============================================================================
// Aggregators
// ============================================================================

export {
  createMeanAggregator,
  createPercentileAggregator,
  createPassRateAggregator,
} from './aggregators';

export type {
  MeanAggregatorOptions,
  PercentileAggregatorOptions,
  PassRateAggregatorOptions,
} from './aggregators';
