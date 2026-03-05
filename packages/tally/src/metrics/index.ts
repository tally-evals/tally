/**
 * Prebuilt Metrics
 *
 * Ready-to-use metric definitions for common evaluation scenarios.
 */

export { createAnswerRelevanceMetric } from './singleTurn/answerRelevance';
export { createAnswerSimilarityMetric } from './singleTurn/answerSimilarity';
export { createCompletenessMetric } from './singleTurn/completeness';
export { createToxicityMetric } from './singleTurn/toxicity';
export { createToolCallAccuracyMetric } from './singleTurn/toolCallAccuracy';
export { createRoleAdherenceMetric } from './multiTurn/roleAdherence';
export { createGoalCompletionMetric } from './multiTurn/goalCompletion';
export { createTopicAdherenceMetric } from './multiTurn/topicAdherence';

// Cashflow Copilot Metrics
export * from './cashflow';

// Metric utilities
export {
  extractInputOutput,
  extractTextFromMessage,
  extractKeywords,
  checkKeywordCoverage,
  extractToolCalls,
} from './common/utils';
export type {
  KeywordExtractionOptions,
  KeywordCoverageResult,
  ExtractedToolCall,
} from './common/utils';
