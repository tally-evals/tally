/**
 * Tool call extraction utilities
 *
 * Unified implementation for extracting tool calls from AI SDK messages.
 * Supports both AI SDK formats:
 * - message.toolCalls array (native AI SDK)
 * - message.content[] with type: 'tool-call' parts (JSONL format)
 */

import type { ConversationStep, ModelMessage } from '../types';
import type { ExtractedToolCall, ExtractedToolResult } from '../types';

/**
 * Helper to safely get a property from an object with unknown structure
 */
function getProperty(obj: unknown, key: string): unknown {
  if (obj && typeof obj === 'object' && key in obj) {
    return (obj as Record<string, unknown>)[key];
  }
  return undefined;
}

/**
 * Extract tool calls from a single ModelMessage
 *
 * Handles both AI SDK formats:
 * - message.toolCalls array (native AI SDK)
 * - message.content[] with type: 'tool-call' parts (JSONL format)
 *
 * @param message - The message to extract tool calls from
 * @returns Array of extracted tool calls
 */
export function extractToolCallFromMessage(message: ModelMessage): ExtractedToolCall[] {
  // Only assistant messages can have tool calls
  if (message.role !== 'assistant') {
    return [];
  }

  const toolCalls: ExtractedToolCall[] = [];
  const seenIds = new Set<string>();

  // Check if message has toolCalls property (AI SDK format)
  if ('toolCalls' in message && Array.isArray(message.toolCalls)) {
    for (const toolCall of message.toolCalls) {
      if (
        typeof toolCall === 'object' &&
        toolCall !== null &&
        'toolCallId' in toolCall &&
        'toolName' in toolCall
      ) {
        const id = String(toolCall.toolCallId);
        if (!seenIds.has(id)) {
          seenIds.add(id);
          toolCalls.push({
            toolCallId: id,
            toolName: String(toolCall.toolName),
            args: 'args' in toolCall ? toolCall.args : {},
          });
        }
      }
    }
  }

  // Also check content array for tool call parts (alternative format)
  if (Array.isArray(message.content)) {
    for (const part of message.content) {
      if (
        typeof part === 'object' &&
        part !== null &&
        'type' in part &&
        part.type === 'tool-call' &&
        'toolCallId' in part &&
        'toolName' in part
      ) {
        const id = String(part.toolCallId);
        if (!seenIds.has(id)) {
          seenIds.add(id);
          // Handle both 'input' (JSONL format) and 'args' (AI SDK format)
          const inputVal = getProperty(part, 'input');
          const argsVal = getProperty(part, 'args');
          const args = inputVal !== undefined ? inputVal : argsVal !== undefined ? argsVal : {};

          toolCalls.push({
            toolCallId: id,
            toolName: String(part.toolName),
            args,
          });
        }
      }
    }
  }

  return toolCalls;
}

/**
 * Extract tool calls from multiple messages
 *
 * Aggregates tool calls from all assistant messages.
 *
 * @param messages - Array of messages to extract from
 * @returns Array of extracted tool calls
 */
export function extractToolCallsFromMessages(
  messages: readonly ModelMessage[]
): ExtractedToolCall[] {
  const toolCalls: ExtractedToolCall[] = [];
  const seenIds = new Set<string>();

  for (const message of messages) {
    const extracted = extractToolCallFromMessage(message);
    for (const tc of extracted) {
      if (!seenIds.has(tc.toolCallId)) {
        seenIds.add(tc.toolCallId);
        toolCalls.push(tc);
      }
    }
  }

  return toolCalls;
}

/**
 * Build an ExtractedToolResult, properly handling optional properties
 */
function buildToolResult(
  toolCallId: string,
  toolName: string | undefined,
  output: unknown
): ExtractedToolResult {
  const result: ExtractedToolResult = {
    toolCallId,
    output,
  };

  if (toolName !== undefined) {
    result.toolName = toolName;
  }

  return result;
}

/**
 * Extract tool results from messages
 *
 * Finds all tool messages and extracts their results.
 *
 * @param messages - Array of messages to extract from
 * @returns Array of extracted tool results
 */
export function extractToolResultsFromMessages(
  messages: readonly ModelMessage[]
): ExtractedToolResult[] {
  const results: ExtractedToolResult[] = [];

  for (const message of messages) {
    if (message.role === 'tool') {
      // Handle different tool message formats
      const msgObj = message as unknown as Record<string, unknown>;

      if ('toolCallId' in msgObj) {
        const toolName = 'toolName' in msgObj ? String(msgObj.toolName) : undefined;
        results.push(
          buildToolResult(String(msgObj.toolCallId), toolName, extractToolResultContent(message))
        );
      }
    }
  }

  return results;
}

/**
 * Extract content from a tool result message
 */
function extractToolResultContent(message: ModelMessage): unknown {
  const msgObj = message as unknown as Record<string, unknown>;

  // Check for content first
  if ('content' in msgObj) {
    const content = msgObj.content;

    // Handle string content
    if (typeof content === 'string') {
      return content;
    }

    // Handle array content
    if (Array.isArray(content)) {
      const parts: string[] = [];
      for (const part of content) {
        if (typeof part === 'string') {
          parts.push(part);
        } else if (part && typeof part === 'object') {
          if ('type' in part && part.type === 'text' && 'text' in part) {
            parts.push(String(part.text));
          } else if ('type' in part && part.type === 'tool-result' && 'result' in part) {
            return part.result;
          }
        }
      }
      return parts.length > 0 ? parts.join('\n') : content;
    }

    return content;
  }

  // Check for result property
  if ('result' in msgObj) {
    return msgObj.result;
  }

  return undefined;
}

/**
 * Match tool calls with their results
 *
 * Returns tool calls with populated 'result' field.
 *
 * @param toolCalls - Array of tool calls to match
 * @param toolResults - Array of tool results to match with
 * @returns Tool calls with results populated
 */
export function matchToolCallsWithResults(
  toolCalls: ExtractedToolCall[],
  toolResults: ExtractedToolResult[]
): ExtractedToolCall[] {
  const resultMap = new Map<string, unknown>();
  for (const result of toolResults) {
    resultMap.set(result.toolCallId, result.output);
  }

  return toolCalls.map((tc) => {
    const result = resultMap.get(tc.toolCallId);
    if (result !== undefined) {
      return { ...tc, result };
    }
    return tc;
  });
}

/**
 * Extract tool calls from a ConversationStep
 *
 * Also matches tool results from the output messages.
 *
 * @param step - The conversation step to extract from
 * @returns Array of extracted tool calls with results
 */
export function extractToolCallsFromStep(step: ConversationStep): ExtractedToolCall[] {
  const toolCalls = extractToolCallsFromMessages(step.output);
  const toolResults = extractToolResultsFromMessages(step.output);
  return matchToolCallsWithResults(toolCalls, toolResults);
}

/**
 * Check if a step contains any tool calls
 */
export function hasToolCalls(step: ConversationStep): boolean {
  return extractToolCallsFromMessages(step.output).length > 0;
}

/**
 * Check if a step contains a specific tool call
 */
export function hasToolCall(step: ConversationStep, toolName: string): boolean {
  const toolCalls = extractToolCallsFromMessages(step.output);
  return toolCalls.some((tc) => tc.toolName === toolName);
}

/**
 * Get all unique tool names used in a step
 */
export function getToolNames(step: ConversationStep): string[] {
  const toolCalls = extractToolCallsFromMessages(step.output);
  const names = new Set(toolCalls.map((tc) => tc.toolName));
  return Array.from(names);
}

/**
 * Count tool calls by type across conversation
 */
export function countToolCallsByType(conversation: {
  steps: readonly ConversationStep[];
}): Map<string, number> {
  const counts = new Map<string, number>();

  for (const step of conversation.steps) {
    const toolCalls = extractToolCallsFromMessages(step.output);
    for (const tc of toolCalls) {
      counts.set(tc.toolName, (counts.get(tc.toolName) ?? 0) + 1);
    }
  }

  return counts;
}

/**
 * Assert all tool calls have matching results
 *
 * Throws if any tool call is missing a result.
 */
export function assertToolCallSequence(step: ConversationStep): void {
  const toolCalls = extractToolCallsFromStep(step);

  for (const tc of toolCalls) {
    if (tc.result === undefined) {
      throw new Error(`Tool call '${tc.toolName}' (${tc.toolCallId}) has no matching result`);
    }
  }
}
