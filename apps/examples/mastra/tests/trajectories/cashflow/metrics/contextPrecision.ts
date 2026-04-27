/**
 * Context Precision Metric
 */

import type { DatasetItem, SingleTurnMetricDef } from '@tally-evals/tally';
import { defineBaseMetric, defineSingleTurnLLM } from '@tally-evals/tally';
import { extractInputOutput } from '@tally-evals/tally/metrics';
import { createMinMaxNormalizer } from '@tally-evals/tally/normalization';
import type { LanguageModel } from 'ai';

export interface ContextPrecisionMetadata {
  providedContext?: string | string[];
  expectedOutput?: string;
  unsupportedClaims?: string[];
}

export interface ContextPrecisionOptions {
  provider: LanguageModel;
}

export function createContextPrecisionMetric(
  options: ContextPrecisionOptions
): SingleTurnMetricDef<number, DatasetItem> {
  const { provider } = options;

  const base = defineBaseMetric({
    name: 'contextPrecision',
    valueType: 'number',
    description:
      'Measures whether the assistant stays tightly grounded in the provided cashflow context',
  });

  const metric = defineSingleTurnLLM<number, DatasetItem>({
    base,
    provider,
    preProcessor: async (selected: DatasetItem) => {
      const { input, output } = extractInputOutput(selected);
      const metadata = selected.metadata as ContextPrecisionMetadata | undefined;

      const providedContext = Array.isArray(metadata?.providedContext)
        ? metadata?.providedContext.join('\n')
        : (metadata?.providedContext ?? 'No additional context supplied.');
      const expectedOutput = metadata?.expectedOutput ?? 'No expected output supplied.';
      const unsupportedClaims = metadata?.unsupportedClaims ?? [];

      return {
        input,
        output,
        providedContext,
        expectedOutput,
        unsupportedClaims: unsupportedClaims.join(', '),
      };
    },
    prompt: {
      instruction: `You are evaluating whether an AI assistant uses the available context precisely.

User Input:
{{input}}

Assistant Response:
{{output}}

Available Context:
{{providedContext}}

Expected Output / Target Behavior:
{{expectedOutput}}

Known Unsupported or Risky Claims:
{{unsupportedClaims}}

Evaluate the assistant's response using the rubric below:
{{rubric}}

Provide your score as a number between 0 and 5.`,
      variables: [] as const,
    },
    rubric: {
      criteria: `Evaluate based on:
1. Grounding: Does the response stay anchored to the available context?
2. Precision: Does it avoid unsupported claims, invented numbers, or unjustified conclusions?
3. Constraint following: Does it avoid adding details that are not supported by the context?
4. Faithfulness: If expected output is supplied, does the answer stay aligned with it without drifting?`,
      scale:
        '0-5 scale where 5 = fully grounded and precise, 0 = heavily unsupported or hallucinated',
      examples: [
        {
          score: 5,
          reasoning:
            'Directly grounded in the available context, no unsupported additions, and stays tightly focused.',
        },
        {
          score: 4,
          reasoning:
            'Mostly grounded and precise, but includes a small unsupported extra or mild overstatement.',
        },
        {
          score: 3,
          reasoning:
            'Partially grounded, but includes some loose phrasing or assumptions beyond the provided context.',
        },
        {
          score: 2,
          reasoning:
            'Noticeable unsupported details or imprecise interpretation of the available context.',
        },
        {
          score: 1,
          reasoning: 'Largely ungrounded response with multiple unsupported additions.',
        },
        {
          score: 0,
          reasoning: 'Response is mostly fabricated or clearly contradicts the available context.',
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
