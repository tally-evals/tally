/**
 * Clarification Request Precision Metric
 */

import type { SingleTargetFor, SingleTurnContainer, SingleTurnMetricDef } from '@tally-evals/tally';
import { defineBaseMetric, defineSingleTurnLLM } from '@tally-evals/tally';
import { extractInputOutput } from '@tally-evals/tally/metrics';
import { createMinMaxNormalizer } from '@tally-evals/tally/normalization';
import type { LanguageModel } from 'ai';

export interface ClarificationPrecisionMetadata {
  shouldClarify: boolean;
  ambiguousTopics?: string[];
  ambiguityType?: string;
}

export interface ClarificationPrecisionOptions {
  provider: LanguageModel;
  penalizeFalsePositives?: boolean;
}

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
