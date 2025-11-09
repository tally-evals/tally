/**
 * Tally - A TypeScript evaluation framework for running model evaluations
 *
 * This framework provides tools for:
 * - Datasets and Conversations (input data)
 * - Evaluators (Selector + Scorer)
 * - Metrics (Boolean, Number, Ordinal/Enum)
 * - Aggregators (summarizing results)
 * - EvaluationReport (final output)
 */

// ============================================================================
// Core Types
// ============================================================================

export type {
	// Data types
	DatasetItem,
	Conversation,
	ConversationStep,

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

	// Evaluator types
	SingleTurnRunPolicy,
	EvaluationContext,
	Evaluator,

	// Aggregator types
	Aggregator,

	// Report types
	PerTargetResult,
	AggregateSummary,
	EvaluationReport,

	// Main container
	Tally,
} from './core/types';

export { toScore } from './core/types';

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
// Normalization
// ============================================================================

export {
	createMinMaxNormalizer,
	createZScoreNormalizer,
	createThresholdNormalizer,
	createLinearNormalizer,
	createOrdinalMapNormalizer,
	createIdentityNormalizer,
	createCustomNormalizer,
} from './core/normalization/factory';

export { applyNormalization } from './core/normalization/apply';
export {
	resolveContext,
	computeDistributionStats,
	computeRange,
	clearContextCache,
	getCachedContext,
} from './core/normalization/context';

// ============================================================================
// OOB Metrics
// ============================================================================

export { createAnswerRelevanceMetric } from './metrics/singleTurn/answerRelevance';
export { createAnswerSimilarityMetric } from './metrics/singleTurn/answerSimilarity';
export { createCompletenessMetric } from './metrics/singleTurn/completeness';
export { createToxicityMetric } from './metrics/singleTurn/toxicity';
export { createToolCallAccuracyMetric } from './metrics/singleTurn/toolCallAccuracy';
export { createRoleAdherenceMetric } from './metrics/multiTurn/roleAdherence';
export { createGoalCompletionMetric } from './metrics/multiTurn/goalCompletion';
export { createTopicAdherenceMetric } from './metrics/multiTurn/topicAdherence';

// ============================================================================
// OOB Scorers
// ============================================================================

export { createWeightedAverageScorer } from './scorers/weightedAverage';
export type { CreateWeightedAverageScorerOptions } from './scorers/weightedAverage';

// ============================================================================
// OOB Aggregators
// ============================================================================

export { createMeanAggregator } from './aggregators/mean';
export { createPercentileAggregator } from './aggregators/percentile';
export { createPassRateAggregator } from './aggregators/passRate';

// ============================================================================
// Data Loaders & Validation
// ============================================================================

export {
	loadDatasetFromJSONL,
	loadConversationsFromJSONL,
	loadFromJSONL,
} from './data/loaders/jsonl';
export type { JSONLLoadOptions } from './data/loaders/jsonl';

export {
	isValidDatasetItem,
	isValidConversation,
	isValidConversationStep,
	isValidDataset,
	isValidConversations,
	assertDatasetItem,
	assertConversation,
	assertDataset,
	assertConversations,
} from './data/validate';

export {
	adaptToDatasetItem,
	adaptToDataset,
	adaptToConversationStep,
	adaptToConversation,
	adaptToConversations,
} from './data/shape';
export type { ShapeAdapterOptions } from './data/shape';

// ============================================================================
// Evaluation Context Helpers
// ============================================================================

export {
	runAllTargets,
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

export { runSingleTurnMetric, runSingleTurnMetrics } from './core/execution/runSingleTurn';
export type { RunSingleTurnOptions } from './core/execution/runSingleTurn';

export { runMultiTurnMetric, runMultiTurnMetrics } from './core/execution/runMultiTurn';
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

// ============================================================================
// Metric Utilities
// ============================================================================

export {
	extractInputOutput,
	extractTextFromMessage,
	extractKeywords,
	checkKeywordCoverage,
	extractToolCalls,
} from './metrics/common/utils';
export type {
	KeywordExtractionOptions,
	KeywordCoverageResult,
	ExtractedToolCall,
} from './metrics/common/utils';
