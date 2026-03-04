/**
 * Over-Clarification Rate Metric
 *
 * An LLM-based single-turn metric that measures whether the assistant asks
 * unnecessary clarifying questions when sufficient information is already provided.
 *
 * Evaluates if the assistant wastes time asking for information that was already
 * clearly stated in the user's input.
 *
 * Supports ConversationStep and DatasetItem containers with metadata indicating
 * whether clarification should NOT be requested.
 */

import type {
  SingleTurnContainer,
  SingleTurnMetricDef,
  SingleTargetFor,
} from '@tally/core/types';
import type { LanguageModel } from 'ai';
import { defineBaseMetric, defineSingleTurnLLM } from '../../core/primitives';
import { createMinMaxNormalizer } from '../../normalizers/factories';
import { extractInputOutput } from '../common/utils';

/**
 * Metadata structure for over-clarification evaluation
 */
export interface OverClarificationMetadata {
  /**
   * Whether clarification should NOT be needed (sufficient info provided)
   */
  shouldNotClarify?: boolean;
  /**
   * Information that is already sufficiently provided in the input
   */
  sufficientInformation?: string[];
}

export interface OverClarificationOptions {
  /**
   * LLM provider for evaluation
   */
  provider: LanguageModel;
  /**
   * Threshold for what constitutes over-clarification
   * @default 'any_unnecessary_question'
   */
  threshold?: 'any_unnecessary_question' | 'multiple_unnecessary_questions';
}

/**
 * Create an over-clarification rate metric
 *
 * Measures whether the assistant asks unnecessary questions when sufficient
 * information is already provided.
 *
 * Scoring (0-5 scale, normalized to 0-1):
 * - 5: Proceeds efficiently with provided information, no unnecessary questions
 * - 4: Minor unnecessary clarification but mostly efficient
 * - 3: Some unnecessary questions but also uses provided information
 * - 2: Multiple unnecessary questions about clearly stated information
 * - 1: Asks for almost all information that was already provided
 * - 0: Completely ignores provided information and asks everything again
 *
 * Note: Higher score is better (less over-clarification)
 *
 * @param options - Configuration options
 * @returns A single-turn metric definition for over-clarification rate
 */
export function createOverClarificationMetric<
  TContainer extends SingleTurnContainer = SingleTurnContainer,
>(options: OverClarificationOptions): SingleTurnMetricDef<number, TContainer> {
  const { provider, threshold = 'any_unnecessary_question' } = options;

  const base = defineBaseMetric({
    name: 'overClarificationRate',
    valueType: 'number',
    description:
      'Measures whether the assistant asks unnecessary questions when sufficient information is provided',
    metadata: {
      threshold,
    },
  });

  const metric = defineSingleTurnLLM<number, TContainer>({
    base,
    provider,
    preProcessor: async (selected: SingleTargetFor<TContainer>) => {
      const { input, output } = extractInputOutput(selected);

      // Extract metadata
      let metadata: OverClarificationMetadata | undefined;

      if ('metadata' in selected && selected.metadata) {
        metadata = selected.metadata as unknown as OverClarificationMetadata;
      }

      const shouldNotClarify = metadata?.shouldNotClarify ?? true;
      const sufficientInfo = metadata?.sufficientInformation ?? [];

      return {
        input,
        output,
        shouldNotClarify,
        sufficientInformation: sufficientInfo.join(', '),
      };
    },
    prompt: {
      instruction: `You are evaluating whether an AI assistant asks unnecessary clarifying questions when the user has already provided sufficient information.

User Input:
{{input}}

Assistant Response:
{{output}}

Ground Truth:
- Sufficient information already provided: {{shouldNotClarify}}
- What information is sufficient: {{sufficientInformation}}

Evaluate the assistant's response using the rubric below:
{{rubric}}

Provide your score as a number between 0 and 5.`,
      variables: [] as const,
    },
    rubric: {
      criteria: `Evaluate based on:
1. Recognition: Did the assistant recognize the information already provided?
2. Efficiency: Did it proceed with the task using available information?
3. Unnecessary questions: Did it ask for information that was already clearly stated?
4. Question necessity: If it asked clarifying questions, were they about truly ambiguous or missing information?`,
      scale:
        '0-5 scale where 5 = efficiently uses provided info (no unnecessary questions), 0 = asks for all info again despite it being provided',
      examples: [
        {
          score: 5,
          reasoning:
            'Efficiently proceeds with clearly stated information, no unnecessary questions',
        },
        {
          score: 4,
          reasoning: 'Minor unnecessary clarification but mostly efficient',
        },
        {
          score: 3,
          reasoning: 'Some unnecessary questions but also uses provided information',
        },
        {
          score: 2,
          reasoning: 'Multiple unnecessary questions about clearly stated information',
        },
        {
          score: 1,
          reasoning: 'Asks for almost all information that was already provided',
        },
        {
          score: 0,
          reasoning: 'Completely ignores provided information and asks everything again',
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

  return metric as SingleTurnMetricDef<number, TContainer>;
}
