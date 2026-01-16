/**
 * Topic Adherence Metric
 *
 * An LLM-based multi-turn metric that measures how well the assistant adheres to specified topics
 * throughout a conversation. Uses LLM-based analysis to score topic adherence on a 0-5 scale,
 * which is then normalized to a 0-1 Score using a min-max normalizer.
 *
 * Works with Conversation containers only.
 */

import { createMultiTurnLLM, defineBaseMetric } from '@tally/core/factory';
import { createMinMaxNormalizer } from '@tally/core/normalization/factory';
import type { Conversation, MultiTurnContainer, MultiTurnMetricDef } from '@tally/core/types';
import type { LanguageModel } from 'ai';
import { extractTextFromMessage, extractTextFromMessages } from '../common/utils';

export interface TopicAdherenceOptions {
  /**
   * Expected topics (required)
   * Array of topics the assistant should adhere to throughout the conversation
   */
  topics: string[];
  /**
   * LLM provider for topic adherence analysis (required)
   */
  provider: LanguageModel;
  /**
   * Allow topic transitions (default: true)
   * If true, allows for natural transitions between related topics within the conversation
   */
  allowTopicTransitions?: boolean;
  /**
   * Strict adherence mode (default: false)
   * If true, penalizes any deviations from the specified topics more strictly
   */
  strictMode?: boolean;
}

/**
 * Create a topic adherence metric
 *
 * Measures how well the assistant adheres to specified topics throughout an entire conversation.
 * Returns a score 0-5 which is normalized to 0-1 Score using a min-max normalizer.
 *
 * Scoring Process:
 * 1. The LLM analyzes all conversation steps to understand the assistant's topic adherence
 * 2. The LLM evaluates how well the assistant stays on the specified topics
 * 3. If topic transitions are allowed, evaluates whether transitions are natural and relevant
 * 4. If strict mode is enabled, applies stricter penalties for topic deviations
 * 5. Score Calculation: LLM returns a score 0-5 based on topic adherence
 * 6. Normalization: Min-max normalizer converts 0-5 to 0-1 Score
 *
 * Score Interpretation (0-5 scale):
 * - 5.0: Assistant perfectly adheres to all specified topics throughout the conversation
 * - 4.0-4.9: Assistant mostly adheres to topics with minor, acceptable deviations
 * - 3.0-3.9: Assistant partially adheres to topics but has noticeable deviations
 * - 2.0-2.9: Assistant occasionally adheres to topics but frequently deviates
 * - 1.0-1.9: Assistant rarely adheres to the specified topics
 * - 0.0-0.9: Assistant does not adhere to the specified topics at all
 *
 * @param options - Configuration options
 * @returns A multi-turn metric definition for topic adherence
 */
export function createTopicAdherenceMetric(
  options: TopicAdherenceOptions
): MultiTurnMetricDef<number, MultiTurnContainer> {
  const { topics, provider, allowTopicTransitions = true, strictMode = false } = options;

  const base = defineBaseMetric({
    name: 'topicAdherence',
    valueType: 'number',
    description:
      'Measures how well the assistant adheres to specified topics throughout an entire conversation',
    metadata: {
      topics,
      allowTopicTransitions,
      strictMode,
    },
  });

  const metric = createMultiTurnLLM<number>({
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
      instruction: `You are evaluating how well an assistant adheres to specified topics throughout a conversation.

Given the expected topics and the conversation below, analyze the assistant's topic adherence using the provided rubric.${allowTopicTransitions ? '\n\nAllow for natural transitions between related topics within the conversation.' : ''}${strictMode ? '\n\nApply strict evaluation - any deviation from the specified topics should be penalized.' : ''}

Rubric:
{{rubric}}

Expected Topics: {{topics}}

Conversation:
{{conversationText}}

Based on your analysis and the rubric, provide your score as a number between 0 and 5.`,
      variables: [] as const,
    },
    rubric: {
      criteria: `Evaluate topic adherence based on:
1. How well the assistant stays on the specified topics throughout the conversation
2. Relevance of the assistant's responses to the expected topics${allowTopicTransitions ? '\n3. Naturalness of topic transitions (if applicable)' : ''}${strictMode ? '\n4. Strict adherence to topics without any deviations' : ''}`,
      scale: '0-5 scale where 5 = perfect topic adherence, 0 = no topic adherence',
      examples: [
        {
          score: 5,
          reasoning:
            'Assistant perfectly adheres to all specified topics throughout the conversation with consistent focus',
        },
        {
          score: 4,
          reasoning:
            'Assistant mostly adheres to topics with minor, acceptable deviations or brief off-topic moments',
        },
        {
          score: 3,
          reasoning:
            'Assistant partially adheres to topics but has noticeable deviations or loses focus',
        },
        {
          score: 2,
          reasoning:
            'Assistant occasionally adheres to topics but frequently deviates or gets sidetracked',
        },
        {
          score: 1,
          reasoning:
            'Assistant rarely adheres to the specified topics and frequently goes off-topic',
        },
        {
          score: 0,
          reasoning:
            'Assistant does not adhere to the specified topics at all and consistently discusses unrelated subjects',
        },
      ],
    },
    normalization: {
      default: createMinMaxNormalizer({
        min: 0,
        max: 5,
        clip: true,
      }),
    },
  });

  // Type assertion: createMultiTurnLLM always returns a multi-turn metric
  return metric as MultiTurnMetricDef<number, Conversation>;
}
