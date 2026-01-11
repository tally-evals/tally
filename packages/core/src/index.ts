/**
 * @tally-evals/core
 *
 * Core types, configuration, and utilities for the Tally evaluation framework.
 */

// =============================================================================
// Types
// =============================================================================

// Message types (re-export from AI SDK)
export type { ModelMessage } from './types/messages';

// Conversation types
export type { Conversation, ConversationStep } from './types/conversation';

// Trajectory types
export type { StepTrace, TrajectoryStopReason } from './types/stepTrace';
export type { TrajectoryMeta } from './types/trajectoryMeta';

// Run metadata types
export type { TrajectoryRunMeta, TallyRunMeta } from './types/runs';

// Tool call types
export type { ExtractedToolCall, ExtractedToolResult } from './types/toolCalls';

// =============================================================================
// Configuration
// =============================================================================

// Config types
export type {
  TallyConfig,
  TallyConfigInput,
  StorageConfigInput,
  DefaultsConfig,
  TrajectoriesConfig,
  EvaluationConfig,
} from './config';

// Config functions
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

// Config constants
export { DEFAULT_CONFIG, CONFIG_FILE_NAMES } from './config';

// =============================================================================
// Storage
// =============================================================================

// Storage types
export type { IStorage, StorageEntry, StorageConfig } from './storage';

// Storage adapters
export { LocalStorage, S2Storage, RedisStorage } from './storage';
export type { S2Config, RedisConfig } from './storage';

// Storage factory
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
  EvaluationReportCodec,
  decodeReport,
  encodeReport,
} from './codecs';

export type { EvaluationReport } from './codecs';

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

// Tool call extraction
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

// Text extraction
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

// Directory scanning
export {
  scanTallyDirectory,
  hasTallyDirectory,
  getConversationsPath,
  getConversationPath,
  getRunsPath,
} from './utils';

// ID generation
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
