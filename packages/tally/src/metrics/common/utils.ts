/**
 * Keyword and text extraction utilities
 *
 * Provides helper functions for extracting keywords, key points, and text content
 * from various container types. Supports both DatasetItem and ConversationStep.
 */

import type { ConversationStep, DatasetItem } from '@tally/core/types';
import { extractWords } from '@tally/utils/text';
import type { LanguageModel, ModelMessage } from 'ai';

/**
 * Options for keyword extraction
 */
export interface KeywordExtractionOptions {
  minLength?: number;
  stopWords?: string[];
  caseSensitive?: boolean;
}

/**
 * Keyword coverage result
 */
export interface KeywordCoverageResult {
  found: string[];
  missing: string[];
  coverage: number; // 0-1 score
}

/**
 * Extract text content from a ModelMessage
 * Handles both string and array content formats
 */
export function extractTextFromMessage(message: ModelMessage): string {
  if (typeof message.content === 'string') {
    return message.content;
  }

  if (Array.isArray(message.content)) {
    // Extract text from all text parts
    return message.content
      .map((part) => {
        if (part.type === 'text') {
          return part.text;
        }
        return '';
      })
      .join(' ');
  }

  return '';
}

/**
 * Extract text content from an array of ModelMessages
 * Aggregates text from all messages, filtering out empty strings
 */
export function extractTextFromMessages(messages: readonly ModelMessage[]): string {
  return messages
    .map(extractTextFromMessage)
    .filter((text) => text.length > 0)
    .join('\n\n');
}

/**
 * Extract tool calls from an array of ModelMessages
 * Iterates through all assistant messages and extracts tool calls
 */
export function extractToolCallsFromMessages(
  messages: readonly ModelMessage[]
): ExtractedToolCall[] {
  const toolCalls: ExtractedToolCall[] = [];
  for (const message of messages) {
    if (message.role === 'assistant') {
      toolCalls.push(...extractToolCalls(message));
    }
  }
  return toolCalls;
}

/**
 * Extract input and output text from DatasetItem or ConversationStep
 *
 * For DatasetItem: returns prompt and completion strings
 * For ConversationStep: extracts text from input and output ModelMessages
 */
export function extractInputOutput(target: DatasetItem | ConversationStep): {
  input: string;
  output: string;
} {
  // Check if it's a DatasetItem
  if ('prompt' in target && 'completion' in target) {
    const item = target as DatasetItem;
    return {
      input: item.prompt,
      output: item.completion,
    };
  }

  // Otherwise it's a ConversationStep
  const step = target as ConversationStep;
  return {
    input: extractTextFromMessage(step.input),
    output: extractTextFromMessages(step.output),
  };
}

/**
 * Extract keywords from text (code-based)
 */
export function extractKeywords(text: string, options?: KeywordExtractionOptions): string[] {
  const { minLength = 2, stopWords = [], caseSensitive = false } = options ?? {};

  const words = extractWords(text);
  const filtered = words
    .filter((word) => {
      // Filter by minimum length
      if (word.length < minLength) {
        return false;
      }
      // Filter stop words
      if (stopWords.length > 0) {
        const searchWord = caseSensitive ? word : word.toLowerCase();
        const searchStopWords = caseSensitive ? stopWords : stopWords.map((s) => s.toLowerCase());
        if (searchStopWords.includes(searchWord)) {
          return false;
        }
      }
      return true;
    })
    // Remove duplicates
    .filter((word, index, arr) => arr.indexOf(word) === index);

  return filtered;
}

/**
 * Extract key points/topics from text (LLM-based)
 *
 * Note: This requires an LLM provider and should be used within an async context
 *
 * @param _text - Text to extract key points from
 * @param _provider - LLM provider for extraction
 * @returns Array of key points
 */
export async function extractKeyPoints(_text: string, _provider: LanguageModel): Promise<string[]> {
  // This would use the LLM to extract key points
  // For now, return empty array - implementation can be added later
  // or this can be handled by the calling metric
  throw new Error('extractKeyPoints: LLM-based extraction not yet implemented');
}

/**
 * Check keyword coverage in text
 */
export function checkKeywordCoverage(
  text: string,
  keywords: string[],
  options?: { caseSensitive?: boolean }
): KeywordCoverageResult {
  const { caseSensitive = false } = options ?? {};

  const searchKeywords = caseSensitive ? keywords : keywords.map((k) => k.toLowerCase());

  const found: string[] = [];
  const missing: string[] = [];

  for (const keyword of searchKeywords) {
    // Check if keyword appears in text (as substring match for phrases)
    const keywordLower = caseSensitive ? keyword : keyword.toLowerCase();
    const textLower = caseSensitive ? text : text.toLowerCase();

    if (textLower.includes(keywordLower)) {
      found.push(keyword);
    } else {
      missing.push(keyword);
    }
  }

  const coverage = keywords.length > 0 ? found.length / keywords.length : 0;

  return {
    found,
    missing,
    coverage,
  };
}

/**
 * Extracted tool call information
 */
export interface ExtractedToolCall {
  toolCallId: string;
  toolName: string;
  args: unknown;
}

/**
 * Extract tool calls from a ModelMessage
 *
 * Extracts tool calls from assistant messages. Returns empty array if:
 * - Message is not an assistant message
 * - Message has no tool calls
 * - Message content is not in expected format
 */
export function extractToolCalls(message: ModelMessage): ExtractedToolCall[] {
  // Only assistant messages can have tool calls
  if (message.role !== 'assistant') {
    return [];
  }

  const toolCalls: ExtractedToolCall[] = [];

  // Check if message has toolCalls property (AI SDK format)
  if ('toolCalls' in message && Array.isArray(message.toolCalls)) {
    for (const toolCall of message.toolCalls) {
      if (
        typeof toolCall === 'object' &&
        toolCall !== null &&
        'toolCallId' in toolCall &&
        'toolName' in toolCall &&
        'args' in toolCall
      ) {
        toolCalls.push({
          toolCallId: String(toolCall.toolCallId),
          toolName: String(toolCall.toolName),
          args: toolCall.args,
        });
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
        // Handle both 'input' (JSONL format) and 'args' (AI SDK format)
        const partObj = part as unknown as Record<string, unknown>;
        const args = 'input' in partObj ? partObj.input : 'args' in partObj ? partObj.args : {};

        toolCalls.push({
          toolCallId: String(part.toolCallId),
          toolName: String(part.toolName),
          args,
        });
      }
    }
  }

  return toolCalls;
}
