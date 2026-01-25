/**
 * Goal Completion Metric
 *
 * An LLM-based multi-turn metric that measures how well the assistant achieves specified goals
 * across an entire conversation. Uses LLM-based analysis to score goal completion on a 0-5 scale,
 * which is then normalized to a 0-1 Score using a min-max normalizer.
 *
 * Works with Conversation containers only.
 */

import { defineMultiTurnLLM, defineBaseMetric } from '../../core/primitives';
import { createMinMaxNormalizer } from '../../normalizers/factories';
import type { Conversation, MultiTurnContainer, MultiTurnMetricDef } from '@tally/core/types';
import type { LanguageModel } from 'ai';
import { extractTextFromMessage, extractTextFromMessages } from '../common/utils';

export interface GoalCompletionOptions {
  /**
   * Goal description (required)
   * Describes the goal the assistant should achieve in the conversation (e.g., "help user book a flight", "troubleshoot a technical issue")
   */
  goal: string;
  /**
   * LLM provider for goal completion analysis (required)
   */
  provider: LanguageModel;
  /**
   * Check for partial completion (default: true)
   * If true, evaluates whether the assistant makes progress toward the goal even if not fully achieved
   */
  checkPartialCompletion?: boolean;
  /**
   * Consider efficiency in scoring (default: false)
   * If true, evaluates how efficiently the assistant achieves the goal (fewer turns is better)
   */
  considerEfficiency?: boolean;
}

/**
 * Create a goal completion metric
 *
 * Measures how well the assistant achieves a specified goal across an entire conversation.
 * Returns a score 0-5 which is normalized to 0-1 Score using a min-max normalizer.
 *
 * Scoring Process:
 * 1. The LLM analyzes all conversation steps to understand the assistant's progress toward the goal
 * 2. The LLM evaluates how well the assistant achieves the specified goal
 * 3. If partial completion checking is enabled, evaluates progress made toward the goal
 * 4. If efficiency checking is enabled, evaluates how efficiently the goal was achieved
 * 5. Score Calculation: LLM returns a score 0-5 based on goal completion
 * 6. Normalization: Min-max normalizer converts 0-5 to 0-1 Score
 *
 * Score Interpretation (0-5 scale):
 * - 5.0: Assistant fully achieves the goal efficiently and effectively
 * - 4.0-4.9: Assistant achieves the goal with minor issues or inefficiencies
 * - 3.0-3.9: Assistant partially achieves the goal or achieves it with significant issues
 * - 2.0-2.9: Assistant makes some progress toward the goal but doesn't achieve it
 * - 1.0-1.9: Assistant makes minimal progress toward the goal
 * - 0.0-0.9: Assistant does not make any meaningful progress toward the goal
 *
 * @param options - Configuration options
 * @returns A multi-turn metric definition for goal completion
 */
export function createGoalCompletionMetric(
  options: GoalCompletionOptions
): MultiTurnMetricDef<number, MultiTurnContainer> {
  const { goal, provider, checkPartialCompletion = true, considerEfficiency = false } = options;

  const base = defineBaseMetric({
    name: 'goalCompletion',
    valueType: 'number',
    description:
      'Measures how well the assistant achieves a specified goal across an entire conversation',
    metadata: {
      goal,
      checkPartialCompletion,
      considerEfficiency,
    },
  });

  const metric = defineMultiTurnLLM<number>({
    base,
    provider,
    runOnContainer: async (conversation) => {
      // Prepare conversation data for the prompt
      // Extract text from all steps for easier analysis
      const conversationText = conversation.steps
        .map((step, index) => {
          const userText = extractTextFromMessage(step.input);
          const assistantText = extractTextFromMessages(step.output);
          return `Turn ${index + 1}:\nUser: ${userText}\nAssistant: ${assistantText}`;
        })
        .join('\n\n');

      return {
        conversationText,
        stepCount: conversation.steps.length,
      };
    },
    prompt: {
      instruction: `You are evaluating how well an assistant achieves a specified goal throughout a conversation.

Given the goal and the conversation below, analyze the assistant's goal completion using the provided rubric.${
        checkPartialCompletion
          ? '\n\nPay attention to partial completion - evaluate whether the assistant makes meaningful progress toward the goal even if not fully achieved.'
          : ''
      }${
        considerEfficiency
          ? '\n\nConsider efficiency - evaluate how many turns it took to achieve the goal.'
          : ''
      }

Rubric:
{{rubric}}

Goal: {{goal}}

Conversation:
{{conversationText}}

Based on your analysis and the rubric, provide your score as a number between 0 and 5.`,
      variables: [] as const,
    },
    rubric: {
      criteria: `Evaluate goal completion based on:
1. How well the assistant achieves the specified goal
2. Quality of the solution or approach taken${
        checkPartialCompletion
          ? '\n3. Progress made toward the goal (even if not fully achieved)'
          : ''
      }${
        considerEfficiency ? '\n4. Efficiency in achieving the goal (fewer turns is better)' : ''
      }`,
      scale: '0-5 scale where 5 = fully achieves goal efficiently, 0 = no progress toward goal',
      examples: [
        {
          score: 5,
          reasoning:
            'Assistant fully achieves the goal efficiently and effectively with a high-quality solution',
        },
        {
          score: 4,
          reasoning: 'Assistant achieves the goal with minor issues or slight inefficiencies',
        },
        {
          score: 3,
          reasoning: 'Assistant partially achieves the goal or achieves it with significant issues',
        },
        {
          score: 2,
          reasoning: "Assistant makes some progress toward the goal but doesn't achieve it",
        },
        {
          score: 1,
          reasoning: 'Assistant makes minimal progress toward the goal',
        },
        {
          score: 0,
          reasoning: 'Assistant does not make any meaningful progress toward the goal',
        },
      ],
    },
    normalization: {
      normalizer: createMinMaxNormalizer({
        min: 0,
        max: 5,
        clip: true,
      }),
    },
  });

  // Type assertion: defineMultiTurnLLM always returns a multi-turn metric
  return metric as MultiTurnMetricDef<number, Conversation>;
}
