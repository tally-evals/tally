/**
 * Clarification Request Precision Metric
 *
 * An LLM-based single-turn metric that measures whether the assistant correctly
 * identifies ambiguous inputs and asks clarifying questions instead of making
 * wrong assumptions.
 *
 * Evaluates if the assistant asks for clarification when information is truly
 * ambiguous or missing, versus making assumptions that could be incorrect.
 *
 * Supports ConversationStep and DatasetItem containers with metadata indicating
 * whether clarification should be requested.
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
 * Metadata structure for clarification precision evaluation
 */
export interface ClarificationPrecisionMetadata {
  /**
   * Whether the assistant should ask for clarification
   */
  shouldClarify: boolean;
  /**
   * Topics/information that are ambiguous or missing
   */
  ambiguousTopics?: string[];
  /**
   * Type of ambiguity (e.g., 'missing_required_fields', 'unclear_value', 'multiple_interpretations')
   */
  ambiguityType?: string;
}

export interface ClarificationPrecisionOptions {
  /**
   * LLM provider for evaluation
   */
  provider: LanguageModel;
  /**
   * Penalize false positives (asking when not needed) more heavily
   * @default true
   */
  penalizeFalsePositives?: boolean;
}

/**
 * Create a clarification request precision metric
 *
 * Measures whether the assistant correctly identifies ambiguous inputs and asks
 * for clarification instead of making assumptions.
 *
 * Scoring (0-5 scale, normalized to 0-1):
 * - 5: Correctly identifies need for clarification and asks appropriate questions
 * - 4: Identifies ambiguity but question could be more specific
 * - 3: Partially identifies ambiguity
 * - 2: Incorrect classification (asks when not needed OR doesn't ask when needed)
 * - 1: Makes wrong assumptions without questioning
 * - 0: Completely fails to handle ambiguity appropriately
 *
 * @param options - Configuration options
 * @returns A single-turn metric definition for clarification request precision
 */
export function createClarificationPrecisionMetric<
  TContainer extends SingleTurnContainer = SingleTurnContainer,
>(options: ClarificationPrecisionOptions): SingleTurnMetricDef<number, TContainer> {
  const { provider, penalizeFalsePositives = true } = options;

  const base = defineBaseMetric({
    name: 'clarificationRequestPrecision',
    valueType: 'number',
    description:
      'Measures whether the assistant correctly identifies ambiguous inputs and asks for clarification',
    metadata: {
      penalizeFalsePositives,
    },
  });

  const metric = defineSingleTurnLLM<number, TContainer>({
    base,
    provider,
    preProcessor: async (selected: SingleTargetFor<TContainer>) => {
      const { input, output } = extractInputOutput(selected);

      // Extract metadata
      let metadata: ClarificationPrecisionMetadata | undefined;

      if ('metadata' in selected && selected.metadata) {
        metadata = selected.metadata as unknown as ClarificationPrecisionMetadata;
      }

      const shouldClarify = metadata?.shouldClarify ?? false;
      const ambiguousTopics = metadata?.ambiguousTopics ?? [];
      const ambiguityType = metadata?.ambiguityType ?? 'unknown';

      return {
        input,
        output,
        shouldClarify,
        ambiguousTopics: ambiguousTopics.join(', '),
        ambiguityType,
      };
    },
    prompt: {
      instruction: `You are evaluating whether an AI assistant correctly identifies when user input is ambiguous and asks for clarification instead of making assumptions.

User Input:
{{input}}

Assistant Response:
{{output}}

Ground Truth:
- Should ask for clarification: {{shouldClarify}}
- Ambiguous topics: {{ambiguousTopics}}
- Ambiguity type: {{ambiguityType}}

Evaluate the assistant's response using the rubric below:
{{rubric}}

Provide your score as a number between 0 and 5.`,
      variables: [] as const,
    },
    rubric: {
      criteria: `Evaluate based on:
1. Correct identification: Did the assistant correctly identify whether the input is ambiguous?
2. Appropriate action: If ambiguous, did it ask for clarification? If not ambiguous, did it proceed without unnecessary questions?
3. Question quality: If asking for clarification, are the questions specific and relevant to the ambiguous information?
4. No assumptions: Did the assistant avoid making assumptions about ambiguous information?`,
      scale:
        '0-5 scale where 5 = perfectly handles ambiguity, 0 = completely fails to handle ambiguity',
      examples: [
        {
          score: 5,
          reasoning:
            'Correctly identifies ambiguous input, asks specific clarifying questions about missing/unclear information',
        },
        {
          score: 4,
          reasoning:
            'Identifies ambiguity and asks for clarification, but questions could be more specific',
        },
        {
          score: 3,
          reasoning: 'Partially identifies ambiguity but may miss some unclear aspects',
        },
        {
          score: 2,
          reasoning:
            'Incorrect classification: asks for clarification when not needed OR fails to ask when needed',
        },
        {
          score: 1,
          reasoning: 'Makes assumptions about ambiguous information without asking',
        },
        {
          score: 0,
          reasoning: 'Completely fails to handle ambiguity appropriately',
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
