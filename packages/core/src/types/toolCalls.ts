/**
 * Tool call types for unified tool call extraction
 */

import type { HILInteractionTrace } from './stepTrace';

/**
 * Unified tool call representation
 *
 * Extracted from assistant messages, supports both AI SDK formats:
 * - message.toolCalls array (native AI SDK)
 * - message.content[] with type: 'tool-call' parts (JSONL format)
 */
export interface ExtractedToolCall {
  /** Unique tool call identifier */
  toolCallId: string;

  /** Name of the tool being invoked */
  toolName: string;

  /** Arguments passed to the tool (aliased as 'input' for compatibility) */
  args: unknown;

  /** Result from tool execution (populated after matching with tool results) */
  result?: unknown;

  /**
   * HIL interaction associated with this tool call, if any.
   *
   * Populated by `extractToolCallsFromStep` when the parent `ConversationStep`
   * has a matching entry in `hilInteractions`. Allows metrics to inspect the
   * approval decision without scanning the step's `hilInteractions` array.
   */
  hilInteraction?: HILInteractionTrace;
}

/**
 * Tool result representation
 *
 * Extracted from tool messages (role: 'tool')
 */
export interface ExtractedToolResult {
  /** Tool call ID this result corresponds to */
  toolCallId: string;

  /** Name of the tool (if available) */
  toolName?: string;

  /** The tool's output */
  output: unknown;
}
