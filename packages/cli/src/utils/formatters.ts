/**
 * Formatter utilities for metrics and text
 */

import { score, verdict } from './colors';

export type MetricScalar = number | boolean | string;

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

/**
 * Normalize a metric value to [0, 1] range
 */
export function normalizeMetricValue(value: MetricScalar): number {
  if (typeof value === 'number') {
    if (value >= 0 && value <= 5) {
      return value / 5;
    }
    if (value >= 0 && value <= 1) {
      return value;
    }
    return Math.max(0, Math.min(1, value));
  }
  if (typeof value === 'boolean') {
    return value ? 1 : 0;
  }
  return 0;
}

/**
 * Apply a [0,1] heatmap color to any text.
 */
export function colorByRate01(value: number, text: string): string {
  const normalized = clamp01(value);

  if (normalized >= 0.8) {
    return score.excellent(text);
  }
  if (normalized >= 0.6) {
    return score.good(text);
  }
  if (normalized >= 0.4) {
    return score.fair(text);
  }
  return score.poor(text);
}

/**
 * Format a [0,1] rate (passRate, failRate, unknownRate, etc.) with heatmap.
 */
export function formatRate01(value: number): string {
  const normalized = clamp01(value);
  const formatted = normalized.toFixed(3);
  return colorByRate01(normalized, formatted);
}

/**
 * Format a score with color based on value.
 *
 * NOTE: This accepts values that may be 0-1 or 0-5 (LLM rubric) and normalizes.
 * Prefer `formatRate01` when you already know it's a [0,1] rate.
 */
export function formatScore(value: number): string {
  const normalized = normalizeMetricValue(value);
  const formatted = normalized.toFixed(3);
  return colorByRate01(normalized, formatted);
}

/**
 * Format a verdict as colored icon
 */
export function formatVerdict(
  verdictValue: 'pass' | 'fail' | 'unknown' | undefined,
): string {
  if (verdictValue === 'pass') {
    return verdict.pass();
  }
  if (verdictValue === 'fail') {
    return verdict.fail();
  }
  return verdict.unknown();
}

/**
 * Remove newline characters and normalize whitespace
 */
export function sanitizeText(text: string): string {
  return text
    .replace(/\n/g, ' ') // Replace newlines with space
    .replace(/\r/g, '') // Remove carriage returns
    .replace(/\s+/g, ' ') // Collapse multiple spaces into one
    .trim(); // Remove leading/trailing whitespace
}

/**
 * Truncate text to max length
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.substring(0, maxLength - 3)}...`;
}

/**
 * Extract text from a single message
 */
export function extractTextFromMessage(message: unknown): string {
  if (typeof message === 'string') {
    return message;
  }
  if (message && typeof message === 'object') {
    const msg = message as { content?: unknown; text?: string };
    if (msg.text) return msg.text;
    if (Array.isArray(msg.content)) {
      return msg.content
        .map((c) => {
          if (typeof c === 'string') return c;
          if (c && typeof c === 'object' && 'text' in c) return String(c.text);
          return '';
        })
        .join(' ');
    }
    if (typeof msg.content === 'string') return msg.content;
  }
  return String(message);
}

/**
 * Extract text from multiple messages
 */
export function extractTextFromMessages(messages: readonly unknown[]): string {
  return messages.map(extractTextFromMessage).join(' ');
}

/**
 * Format conversation text with Input and Output on separate lines
 */
export function formatConversationText(input: string, output: string): string {
  return `Input: ${input}\nOutput: ${output}`;
}

/**
 * Extract tool calls from a single message
 */
export function extractToolCallsFromMessage(
  message: unknown,
): { toolName: string; toolCallId: string; output?: unknown }[] {
  const toolCalls: {
    toolName: string;
    toolCallId: string;
    output?: unknown;
  }[] = [];

  if (message && typeof message === 'object') {
    const msg = message as { content?: unknown };
    if (Array.isArray(msg.content)) {
      for (const part of msg.content) {
        if (
          part &&
          typeof part === 'object' &&
          'type' in part &&
          part.type === 'tool-call'
        ) {
          const toolPart = part as {
            toolName?: string;
            toolCallId?: string;
            output?: unknown;
          };
          if (toolPart.toolName) {
            toolCalls.push({
              toolName: toolPart.toolName,
              toolCallId: toolPart.toolCallId ?? '',
              output: toolPart.output,
            });
          }
        }
      }
    }
  }

  return toolCalls;
}

/**
 * Extract tool calls from multiple messages
 */
export function extractToolCallsFromMessages(
  messages: readonly unknown[],
): { toolName: string; toolCallId: string; output?: unknown }[] {
  const allToolCalls = new Set<{
    toolName: string;
    toolCallId: string;
    output?: unknown;
  }>();
  for (const message of messages) {
    const toolCalls = extractToolCallsFromMessage(message);
    for (const tc of toolCalls) {
      allToolCalls.add({
        toolName: tc.toolName,
        toolCallId: tc.toolCallId,
        output: tc.output,
      });
    }
  }
  return Array.from(allToolCalls);
}
