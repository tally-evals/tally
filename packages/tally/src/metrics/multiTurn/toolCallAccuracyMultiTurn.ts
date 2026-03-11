/**
 * Tool Call Accuracy (Multi-Turn) Metric
 *
 * A code-based multi-turn metric that measures accuracy of tool calls across an
 * entire conversation. It extracts tool calls from all assistant outputs and
 * compares them against expected calls with optional argument validation, order
 * checking, and strict mode.
 */

import { defineMultiTurnCode, defineBaseMetric } from '../../core/primitives';
import { createIdentityNormalizer } from '../../normalizers/factories';
import type { Conversation, MultiTurnContainer, MultiTurnMetricDef } from '@tally/core/types';
import type { z } from 'zod';
import { type ExtractedToolCall, extractToolCallsFromMessages } from '../common/utils';

export interface ToolCallAccuracyMultiTurnOptions {
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
}

/**
 * Create a multi-turn tool call accuracy metric.
 *
 * Scoring:
 * - Presence: Each expected tool call is present (1.0 per call)
 * - Arguments: If argsSchema provided, validates arguments match schema (1.0 per call)
 * - Order: If toolCallOrder provided, evaluates order correctness (1.0 if correct)
 * - Strict mode: If enabled, penalizes extra tool calls and requires exact sequence
 *
 * Final score: Weighted average of presence, arguments, and order (0-1 scale)
 */
export function createToolCallAccuracyMultiTurnMetric(
  options: ToolCallAccuracyMultiTurnOptions
): MultiTurnMetricDef<number, MultiTurnContainer> {
  const { expectedToolCalls, toolCallOrder, strictMode = false } = options;

  // Defines metadata for the metric
  const base = defineBaseMetric({
    name: 'toolCallAccuracyMultiTurn',
    valueType: 'number',
    description:
      'Measures tool call accuracy across an entire conversation by comparing actual calls against expected calls',
    metadata: {
      expectedToolCalls: expectedToolCalls.map((call) => ({
        toolName: call.toolName,
        hasArgsSchema: call.argsSchema !== undefined,
      })),
      toolCallOrder,
      strictMode,
    },
  });

  // Defines the metric
  const metric = defineMultiTurnCode<number>({
    base,
    
    /*Goes through every step in the conversation and extracts the tool calls 
    if the assistent call tolls on turn 2, 4, 7, this gathers all of them into one combined array.
*/
    runOnContainer: async (conversation) => {
      const toolCalls: ExtractedToolCall[] = [];

      for (const step of conversation.steps) {
        toolCalls.push(...extractToolCallsFromMessages(step.output));
      }

      return { toolCalls };
    },
    /*
    compute:  scores those extracted tool calls against the expected tool calls.
    */
    compute: ({ data }) => {
      const payload = data as { toolCalls?: ExtractedToolCall[] } | undefined;
      const actualToolCalls = payload?.toolCalls ?? [];

      if (strictMode && actualToolCalls.length !== expectedToolCalls.length) {
        return 0;
      }

      const matchedCalls = new Set<string>();
      for (const expected of expectedToolCalls) {
        const found = actualToolCalls.find((actual) => actual.toolName === expected.toolName);
        if (found) {
          matchedCalls.add(expected.toolName);
        }
      }
      /*calculates 3 sub-scores: presence, argument, and order 
      presence score: how many expected tool calls are present in the actual tool calls.
      argument score: how many expected tool calls have valid arguments.
      order score: how many expected tool calls are in the correct order.
      */
      const presenceScore =
        expectedToolCalls.length > 0 ? matchedCalls.size / expectedToolCalls.length : 1.0;

      let validatedCount = 0;
      let schemasCount = 0;
      for (const expected of expectedToolCalls) {
        if (expected.argsSchema) {
          schemasCount++;
          const actualCall = actualToolCalls.find((actual) => actual.toolName === expected.toolName);
          if (actualCall) {
            try {
              expected.argsSchema.parse(actualCall.args);
              validatedCount++;
            } catch {
              // Validation failed
            }
          }
        }
      }
      const argumentScore = schemasCount > 0 ? validatedCount / schemasCount : 1.0;

      let orderScore = 1.0;
      if (toolCallOrder && toolCallOrder.length > 0) {
        const actualOrder = actualToolCalls.map((call) => call.toolName);

        const filteredActualOrder = strictMode
          ? actualOrder
          : actualOrder.filter((name) => expectedToolCalls.some((exp) => exp.toolName === name));

        const filteredExpectedOrder = toolCallOrder.filter((name) =>
          actualToolCalls.some((call) => call.toolName === name)
        );

        if (strictMode) {
          if (
            filteredActualOrder.length !== filteredExpectedOrder.length ||
            !filteredActualOrder.every((name, index) => name === filteredExpectedOrder[index])
          ) {
            return 0;
          }
          orderScore = 1.0;
        } else if (filteredExpectedOrder.length === 0) {
          orderScore = 1.0;
        } else {
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
 /*
 final score is a weighted average of the 3 sub-scores. The weights are 0.5 for presence, 0.3 for argument, and 0.2 for order.
 the weight defines the importance of each sub-score in the final score. 
 */
      const finalScore = presenceScore * 0.5 + argumentScore * 0.3 + orderScore * 0.2;
      return Math.min(1, Math.max(0, finalScore));
    },
    // normalizes the final score to a 0-1 scale. 
    cacheable: true,
    normalization: {
      normalizer: createIdentityNormalizer(),
    },
  });

  return metric as MultiTurnMetricDef<number, Conversation>;
}
