/**
 * Conversation types - canonical definitions for multi-turn conversations
 */

import type { ModelMessage } from './messages';

/**
 * A single turn in a conversation
 *
 * Represents one user input and the assistant's response(s).
 * The output array captures tool calls, tool results, and final response.
 */
export interface ConversationStep {
  /** Stable ordering within the conversation */
  stepIndex: number;

  /** User (or tool) request */
  input: ModelMessage;

  /** Assistant response(s) - array to capture tool calls and final response */
  output: readonly ModelMessage[];

  /** Provider message ID if available */
  id?: string;

  /** When this step occurred */
  timestamp?: Date;

  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * A complete multi-turn conversation
 *
 * Contains an ordered list of steps representing the full conversation history.
 */
export interface Conversation {
  /** Unique conversation identifier */
  id: string;

  /** Ordered steps in the conversation */
  steps: readonly ConversationStep[];

  /** Conversation-level metadata */
  metadata?: Record<string, unknown>;
}
