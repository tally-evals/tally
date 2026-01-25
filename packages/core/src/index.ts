/**
 * @tally-evals/core
 *
 * Core types, configuration, and utilities for the Tally evaluation framework.
 */

// =============================================================================
// Types - Primitives
// =============================================================================

export type {
  MetricScalar,
  Score,
  ValueTypeFor,
  MetricScope,
  DatasetItem,
} from './types/primitives';

export { toScore } from './types/primitives';

// =============================================================================
// Types - Messages & Conversations
// =============================================================================

export type { ModelMessage } from './types/messages';
export type { Conversation, ConversationStep } from './types/conversation';

// =============================================================================
// Types - Trajectories
// =============================================================================

export type { StepTrace, TrajectoryStopReason } from './types/stepTrace';
export type { TrajectoryMeta } from './types/trajectoryMeta';

// =============================================================================
// Types - Run Metadata
// =============================================================================

export type { TrajectoryRunMeta, TallyRunMeta } from './types/runs';

// =============================================================================
// Types - Tool Calls
// =============================================================================

export type { ExtractedToolCall, ExtractedToolResult } from './types/toolCalls';

// =============================================================================
// Types - Normalization
// =============================================================================

export type {
  NumericNormalizationContext,
  BooleanNormalizationContext,
  OrdinalNormalizationContext,
  NormalizationContextFor,
  MetricInfo,
  NormalizeToScore,
  NormalizerSpec,
  MetricNormalization,
} from './types/normalization';

// =============================================================================
// Types - Metrics
// =============================================================================

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
} from './types/metrics';

// =============================================================================
// Types - Scorers
// =============================================================================

export type { ScorerInput, InputScores, Scorer } from './types/scorers';

// =============================================================================
// Types - Evaluators
// =============================================================================

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
} from './types/evaluators';

// =============================================================================
// Types - Core Results (unified)
// =============================================================================

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
} from './types/results';

// =============================================================================
// Types - Run Artifact (serialization)
// =============================================================================

export type { TallyRunArtifact } from './types/runArtifact';

// =============================================================================
// Types - SDK Report/View
// =============================================================================

export type { TargetRunView } from './types/runView';
export type { TallyRunReport } from './types/runReport';

// =============================================================================
// Types - Tally Container
// =============================================================================

export type { Tally, TallyRunOptions } from './types/tally';

// =============================================================================
// Configuration
// =============================================================================

export type {
  TallyConfig,
  TallyConfigInput,
  StorageConfigInput,
  DefaultsConfig,
  TrajectoriesConfig,
  EvaluationConfig,
} from './config';

export {
  defineConfig,
  resolveConfig,
  getConfig,
  clearConfigCache,
  mergeConfig,
  validateConfig,
  findConfigFile,
  loadConfigFile,
  isInTallyProject,
} from './config';

export { DEFAULT_CONFIG, CONFIG_FILE_NAMES } from './config';

// =============================================================================
// Storage
// =============================================================================

export type { IStorage, StorageEntry, StorageConfig } from './storage';
export { LocalStorage, S2Storage, RedisStorage } from './storage';
export type { S2Config, RedisConfig } from './storage';
export { createStorage } from './storage';

// =============================================================================
// Store (high-level, backend-agnostic)
// =============================================================================

export { ConversationRef, RunRef, TallyStore } from './store';
export type { RunType } from './store';

// =============================================================================
// Codecs
// =============================================================================

export {
  ConversationCodec,
  decodeConversation,
  encodeConversation,
  decodeRunArtifact,
  encodeRunArtifact,
} from './codecs';

// =============================================================================
// Conversion
// =============================================================================

export {
  stepTracesToConversation,
  conversationToStepTraces,
  conversationStepToStepTrace,
} from './conversion';

export type {
  StepTracesToConversationOptions,
  ConversationToStepTracesOptions,
} from './conversion';

// =============================================================================
// Utils - Message Extraction
// =============================================================================

export {
  extractToolCallFromMessage,
  extractToolCallsFromMessages,
  extractToolCallsFromStep,
  extractToolResultsFromMessages,
  matchToolCallsWithResults,
  hasToolCalls,
  hasToolCall,
  getToolNames,
  countToolCallsByType,
  assertToolCallSequence,
} from './utils';

export {
  extractTextFromMessage,
  extractTextFromMessages,
  extractToolResultContent,
  hasTextContent,
  getFirstTextContent,
} from './utils';

// =============================================================================
// Utils - Directory & IDs
// =============================================================================

export {
  scanTallyDirectory,
  hasTallyDirectory,
  getConversationsPath,
  getConversationPath,
  getRunsPath,
} from './utils';

export {
  generateRunId,
  generateConversationId,
  generateTrajectoryId,
  extractTimestampFromId,
} from './utils';

// =============================================================================
// Constants
// =============================================================================

export {
  CONVERSATIONS,
  CONVERSATION,
  RUNS,
  TRAJECTORY,
  TALLY,
  META,
  RUN_INDEX,
} from './constants';
