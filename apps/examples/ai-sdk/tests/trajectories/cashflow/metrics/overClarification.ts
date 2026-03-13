/**
 * Over-Clarification Rate Metric
 */

import type { SingleTargetFor, SingleTurnContainer, SingleTurnMetricDef } from '@tally-evals/tally';
import { defineBaseMetric, defineSingleTurnLLM } from '@tally-evals/tally';
import { extractInputOutput } from '@tally-evals/tally/metrics';
import { createMinMaxNormalizer } from '@tally-evals/tally/normalization';
import type { LanguageModel } from 'ai';

export interface OverClarificationMetadata {
  shouldNotClarify?: boolean;
  sufficientInformation?: string[];
}

export interface OverClarificationOptions {
  provider: LanguageModel;
  threshold?: 'any_unnecessary_question' | 'multiple_unnecessary_questions';
}

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
