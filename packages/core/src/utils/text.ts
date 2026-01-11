/**
 * Text extraction utilities
 *
 * Unified implementation for extracting text content from AI SDK messages.
 * Handles both string content and content part arrays.
 */

import type { ModelMessage } from '../types';

/**
 * Extract text content from a ModelMessage
 *
 * Handles both string and array content formats.
 *
 * @param message - The message to extract text from
 * @returns Extracted text content
 */
export function extractTextFromMessage(message: ModelMessage): string {
  const content = message.content;

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
      } else if (part && typeof part === 'object' && 'type' in part) {
        if (part.type === 'text' && 'text' in part) {
          parts.push(String(part.text));
        }
        // Skip tool-call and other part types
      }
    }

    return parts.join(' ').trim();
  }

  return '';
}

/**
 * Extract text content from multiple messages
 *
 * Aggregates text from all messages, filtering empty strings.
 *
 * @param messages - Array of messages to extract from
 * @returns Combined text content, separated by double newlines
 */
export function extractTextFromMessages(messages: readonly ModelMessage[]): string {
  return messages
    .map(extractTextFromMessage)
    .filter((text) => text.length > 0)
    .join('\n\n');
}

/**
 * Extract text content from a tool result message
 *
 * Handles various output formats (text, json, error, content).
 *
 * @param message - The tool message to extract content from
 * @returns Extracted text content
 */
export function extractToolResultContent(message: ModelMessage): string {
  if (message.role !== 'tool') {
    return '';
  }

  const msgObj = message as Record<string, unknown>;

  // Check content property
  if ('content' in msgObj) {
    const content = msgObj.content;

    if (typeof content === 'string') {
      return content;
    }

    if (Array.isArray(content)) {
      const parts: string[] = [];

      for (const part of content) {
        if (typeof part === 'string') {
          parts.push(part);
        } else if (part && typeof part === 'object') {
          if ('type' in part && part.type === 'text' && 'text' in part) {
            parts.push(String(part.text));
          } else if ('type' in part && part.type === 'tool-result' && 'result' in part) {
            const result = part.result;
            if (typeof result === 'string') {
              parts.push(result);
            } else {
              parts.push(JSON.stringify(result));
            }
          }
        }
      }

      return parts.join('\n');
    }

    // Try to stringify other content types
    if (typeof content === 'object' && content !== null) {
      return JSON.stringify(content);
    }

    return String(content);
  }

  // Check result property
  if ('result' in msgObj) {
    const result = msgObj.result;
    if (typeof result === 'string') {
      return result;
    }
    return JSON.stringify(result);
  }

  return '';
}

/**
 * Check if a message contains text content
 */
export function hasTextContent(message: ModelMessage): boolean {
  return extractTextFromMessage(message).length > 0;
}

/**
 * Get the first text content from a message, or undefined if none
 */
export function getFirstTextContent(message: ModelMessage): string | undefined {
  const text = extractTextFromMessage(message);
  return text.length > 0 ? text : undefined;
}
