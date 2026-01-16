/**
 * Data Loaders & Validation
 *
 * Utilities for loading and validating datasets and conversations.
 */

export {
  loadDatasetFromJSONL,
  loadConversationsFromJSONL,
  loadFromJSONL,
  loadConversationStepsFromJSONL,
} from './loaders/jsonl';
export type { JSONLLoadOptions } from './loaders/jsonl';

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
} from './validate';

export {
  adaptToDatasetItem,
  adaptToDataset,
  adaptToConversationStep,
  adaptToConversation,
  adaptToConversations,
} from './shape';
export type { ShapeAdapterOptions } from './shape';
