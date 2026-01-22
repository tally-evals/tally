/**
 * Tool Call Accuracy Metric
 *
 * A code-based single-turn metric that measures accuracy of tool calls in assistant responses.
 * Extracts tool calls from the output and compares them against expected calls with optional
 * argument validation, order checking, and strict mode.
 *
 * Supports both DatasetItem and ConversationStep containers.
 */

import { createSingleTurnCode, defineBaseMetric } from '@tally/core/factory';
import { createIdentityNormalizer } from '@tally/core/normalization/factory';
import type {
  ConversationStep,
  DatasetItem,
  NumericAggregatorDef,
  SingleTurnContainer,
  SingleTurnMetricDef,
} from '@tally/core/types';
import type { ModelMessage } from 'ai';
import type { z } from 'zod';
import {
  type ExtractedToolCall,
  extractToolCalls,
  extractToolCallsFromMessages,
} from '../common/utils';

export interface ToolCallAccuracyOptions {
  /**
   * Expected tool calls (required)
   */
  expectedToolCalls: Array<{
    toolName: string;
    argsSchema?: z.ZodSchema; // Optional Zod schema for validating arguments
  }>;
  /**
   * Tool call order (optional)
   * If provided, evaluates whether actual tool calls match this exact order
   */
  toolCallOrder?: string[]; // Array of tool names in expected order
  /**
   * Strict mode (default: false)
   * If true: sequence must be exact and cannot have more tool calls than expected
   * If false: allows extra tool calls and evaluates presence/order more leniently
   */
  strictMode?: boolean;
  /**
   * Aggregators to apply to the metric
   * @default Percentiles: 50, 75, 90
   */
  aggregators?: NumericAggregatorDef[];
}

/**
 * Create a tool call accuracy metric
 *
 * Measures accuracy of tool calls in assistant responses.
 * Code-based metric that extracts tool calls and compares them against expected calls.
 * Supports both DatasetItem and ConversationStep containers.
 *
 * Scoring:
 * - Presence: Each expected tool call is present (1.0 per call)
 * - Arguments: If argsSchema provided, validates arguments match schema (1.0 per call)
 * - Order: If toolCallOrder provided, evaluates order correctness (1.0 if correct)
 * - Strict mode: If enabled, penalizes extra tool calls and requires exact sequence
 *
 * Final score: Weighted average of presence, arguments, and order (0-1 scale)
 *
 * @param options - Configuration options
 * @returns A single-turn metric definition for tool call accuracy
 */
export function createToolCallAccuracyMetric<
  TContainer extends SingleTurnContainer = SingleTurnContainer,
>(options: ToolCallAccuracyOptions): SingleTurnMetricDef<number, TContainer> {
  const { expectedToolCalls, toolCallOrder, strictMode = false, aggregators } = options;

  const base = defineBaseMetric({
    name: 'toolCallAccuracy',
    valueType: 'number',
    description:
      'Measures accuracy of tool calls in assistant responses by comparing actual calls against expected calls',
  });

  const metric = createSingleTurnCode<number, TContainer>({
    ...(aggregators !== undefined && { aggregators }),
    base,
    preProcessor: async (selected) => {
      // Extract tool calls from output only
      let toolCalls: ExtractedToolCall[] = [];

      // Handle DatasetItem: completion might be a ModelMessage or string
      if ('prompt' in selected && 'completion' in selected) {
        const item = selected as DatasetItem;
        // Check if completion is a ModelMessage
        if (
          typeof item.completion === 'object' &&
          item.completion !== null &&
          'role' in item.completion &&
          'content' in item.completion
        ) {
          const outputMessage = item.completion as ModelMessage;
          toolCalls = extractToolCalls(outputMessage);
        } else {
          // If completion is a string, we can't extract tool calls
          // Return empty tool calls
          return { toolCalls: [] };
        }
      }
      // Handle ConversationStep: extract from output array of ModelMessages
      else if ('input' in selected && 'output' in selected) {
        const step = selected as ConversationStep;
        toolCalls = extractToolCallsFromMessages(step.output);
      }

      return { toolCalls };
    },
    compute: ({ data }) => {
      const payload = data as { toolCalls?: ExtractedToolCall[] } | undefined;
      const actualToolCalls = payload?.toolCalls ?? [];

      // Strict mode: check if we have exactly the expected number of calls
      if (strictMode) {
        if (actualToolCalls.length !== expectedToolCalls.length) {
          return 0;
        }
      }

      // Calculate presence score
      const matchedCalls = new Set<string>();
      for (const expected of expectedToolCalls) {
        const found = actualToolCalls.find((actual) => actual.toolName === expected.toolName);
        if (found) {
          matchedCalls.add(expected.toolName);
        }
      }
      const presenceScore =
        expectedToolCalls.length > 0 ? matchedCalls.size / expectedToolCalls.length : 1.0;

      // Calculate argument validation score
      let validatedCount = 0;
      let schemasCount = 0;
      for (const expected of expectedToolCalls) {
        if (expected.argsSchema) {
          schemasCount++;
          const actualCall = actualToolCalls.find(
            (actual) => actual.toolName === expected.toolName
          );
          if (actualCall) {
            try {
              // Validate args against schema
              expected.argsSchema.parse(actualCall.args);
              validatedCount++;
            } catch {
              // Validation failed
            }
          }
        }
      }
      const argumentScore = schemasCount > 0 ? validatedCount / schemasCount : 1.0;

      // Calculate order score
      let orderScore = 1.0;
      if (toolCallOrder && toolCallOrder.length > 0) {
        // Extract tool names from actual calls in order
        const actualOrder = actualToolCalls.map((call) => call.toolName);

        // Filter to only expected calls (for non-strict mode)
        const filteredActualOrder = strictMode
          ? actualOrder
          : actualOrder.filter((name) => expectedToolCalls.some((exp) => exp.toolName === name));

        // Filter expected order to only calls that exist in actual
        const filteredExpectedOrder = toolCallOrder.filter((name) =>
          actualToolCalls.some((call) => call.toolName === name)
        );

        if (strictMode) {
          // Exact match required
          if (
            filteredActualOrder.length !== filteredExpectedOrder.length ||
            !filteredActualOrder.every((name, index) => name === filteredExpectedOrder[index])
          ) {
            return 0; // Strict mode fails immediately
          }
          orderScore = 1.0;
        } else {
          // Calculate partial order match
          if (filteredExpectedOrder.length === 0) {
            orderScore = 1.0; // No order to check
          } else {
            // Count how many pairs are in correct order
            let correctPairs = 0;
            let totalPairs = 0;

            for (let i = 0; i < filteredExpectedOrder.length - 1; i++) {
              const first = filteredExpectedOrder[i];
              const second = filteredExpectedOrder[i + 1];

              if (first && second) {
                const firstIndex = filteredActualOrder.indexOf(first);
                const secondIndex = filteredActualOrder.indexOf(second);

                if (firstIndex !== -1 && secondIndex !== -1) {
                  totalPairs++;
                  if (firstIndex < secondIndex) {
                    correctPairs++;
                  }
                }
              }
            }

            orderScore = totalPairs > 0 ? correctPairs / totalPairs : 1.0;
          }
        }
      }

      // Calculate final weighted score
      // Presence: 0.5, Arguments: 0.3, Order: 0.2
      const finalScore = presenceScore * 0.5 + argumentScore * 0.3 + orderScore * 0.2;

      return Math.min(1, Math.max(0, finalScore));
    },
    cacheable: true,
    normalization: {
      normalizer: createIdentityNormalizer(),
    },
  });

  // Type assertion: createSingleTurnCode always returns a single-turn metric
  return metric as SingleTurnMetricDef<number, TContainer>;
}
