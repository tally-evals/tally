/**
 * Context Recall Metric
 */

import type { DatasetItem, SingleTurnMetricDef } from '@tally-evals/tally';
import { defineBaseMetric, defineSingleTurnLLM } from '@tally-evals/tally';
import { extractInputOutput } from '@tally-evals/tally/metrics';
import { createMinMaxNormalizer } from '@tally-evals/tally/normalization';
import type { LanguageModel } from 'ai';

export interface ContextRecallMetadata {
  providedContext?: string | string[];
  expectedOutput?: string;
  requiredFacts?: string[];
}

export interface ContextRecallOptions {
  provider: LanguageModel;
}

export function createContextRecallMetric(
  options: ContextRecallOptions
): SingleTurnMetricDef<number, DatasetItem> {
  const { provider } = options;

  const base = defineBaseMetric({
    name: 'contextRecall',
    valueType: 'number',
    description:
      'Measures whether the assistant includes the important information available in the cashflow context',
  });

  const metric = defineSingleTurnLLM<number, DatasetItem>({
    base,
    provider,
    preProcessor: async (selected: DatasetItem) => {
      const { input, output } = extractInputOutput(selected);
      const metadata = selected.metadata as ContextRecallMetadata | undefined;

      const providedContext = Array.isArray(metadata?.providedContext)
        ? metadata?.providedContext.join('\n')
        : (metadata?.providedContext ?? 'No additional context supplied.');
      const expectedOutput = metadata?.expectedOutput ?? 'No expected output supplied.';
      const requiredFacts = metadata?.requiredFacts ?? [];

      return {
        input,
        output,
        providedContext,
        expectedOutput,
        requiredFacts: requiredFacts.join(', '),
      };
    },
    prompt: {
      instruction: `You are evaluating whether an AI assistant recalls the important information present in the available context.

User Input:
{{input}}

Assistant Response:
{{output}}

Available Context:
{{providedContext}}

Expected Output / Target Behavior:
{{expectedOutput}}

Required Facts to Cover:
{{requiredFacts}}

Evaluate the assistant's response using the rubric below:
{{rubric}}

Provide your score as a number between 0 and 5.`,
      variables: [] as const,
    },
    rubric: {
      criteria: `Evaluate based on:
1. Coverage: Does the response include the important information that is present in the context?
2. Completeness: Does it avoid omitting key facts that should reasonably be mentioned?
3. Usefulness: Does it surface the context details needed to answer the user well?
4. Alignment: If expected output or required facts are supplied, does the answer cover them adequately?`,
      scale:
        '0-5 scale where 5 = captures all key context-supported information, 0 = misses nearly everything important',
      examples: [
        {
          score: 5,
          reasoning:
            'Covers all important context-supported facts needed for a strong answer and misses nothing material.',
        },
        {
          score: 4,
          reasoning: 'Covers most important facts, with only a small omission.',
        },
        {
          score: 3,
          reasoning:
            'Covers some relevant facts but leaves out one or more important context-supported details.',
        },
        {
          score: 2,
          reasoning:
            'Misses several key points from the available context and gives only partial coverage.',
        },
        {
          score: 1,
          reasoning: 'Includes very little of the important information available in context.',
        },
        {
          score: 0,
          reasoning: 'Fails to use the relevant context in any meaningful way.',
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

  return metric as SingleTurnMetricDef<number, DatasetItem>;
}
