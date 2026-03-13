/**
 * Affordability Decision Accuracy Metric
 */

import type { DatasetItem, SingleTurnMetricDef } from '@tally-evals/tally';
import { defineBaseMetric, defineSingleTurnLLM } from '@tally-evals/tally';
import { extractInputOutput } from '@tally-evals/tally/metrics';
import { createMinMaxNormalizer } from '@tally-evals/tally/normalization';
import type { LanguageModel } from 'ai';

export type AffordabilityDecision = 'yes' | 'no' | 'conditional_yes' | 'conditional_no';

export interface AffordabilityDecisionMetadata {
  expectedDecision: AffordabilityDecision;
  currentBalance?: number;
  safetyBuffer?: number;
  projectedMinBalance?: number;
  upcomingCommitments?: Array<{
    name: string;
    amount: number;
    date?: string;
  }>;
  requestedAmount?: number;
  expectedReasoning?: string[];
}

export interface AffordabilityDecisionOptions {
  provider: LanguageModel;
  weights?: {
    decision: number;
    reasoning: number;
  };
}

export function createAffordabilityDecisionMetric(
  options: AffordabilityDecisionOptions
): SingleTurnMetricDef<number, DatasetItem> {
  const { provider, weights = { decision: 0.7, reasoning: 0.3 } } = options;

  const base = defineBaseMetric({
    name: 'affordabilityDecisionAccuracy',
    valueType: 'number',
    description: 'Measures whether the assistant correctly determines if expenses are affordable',
    metadata: {
      weights,
    },
  });

  const metric = defineSingleTurnLLM<number, DatasetItem>({
    base,
    provider,
    preProcessor: async (selected) => {
      const { input, output } = extractInputOutput(selected);

      const metadata = selected.metadata as AffordabilityDecisionMetadata | undefined;

      const expectedDecision = metadata?.expectedDecision ?? 'unknown';
      const currentBalance = metadata?.currentBalance ?? 0;
      const safetyBuffer = metadata?.safetyBuffer ?? 0;
      const projectedMinBalance = metadata?.projectedMinBalance ?? 0;
      const upcomingCommitments = metadata?.upcomingCommitments ?? [];
      const requestedAmount = metadata?.requestedAmount ?? 0;
      const expectedReasoning = metadata?.expectedReasoning ?? [];

      return {
        input,
        output,
        expectedDecision,
        currentBalance,
        safetyBuffer,
        projectedMinBalance,
        upcomingCommitments: JSON.stringify(upcomingCommitments || [], null, 2),
        requestedAmount,
        expectedReasoning: (expectedReasoning || []).join(', '),
      };
    },
    prompt: {
      instruction: `You are evaluating whether an AI assistant correctly determines if an expense is affordable based on cashflow state.

User Query:
{{input}}

Assistant Response:
{{output}}

Cashflow Context:
- Current Balance: $ {{currentBalance}}
- Safety Buffer: $ {{safetyBuffer}}
- Requested Amount: $ {{requestedAmount}}
- Projected Min Balance (after expense): $ {{projectedMinBalance}}
- Upcoming Commitments: {{upcomingCommitments}}

Ground Truth:
- Expected Decision: {{expectedDecision}}
- Expected Reasoning Factors: {{expectedReasoning}}

Evaluate the assistant's affordability decision using the rubric below:
{{rubric}}

Provide your score as a number between 0 and 5.`,
      variables: [] as const,
    },
    rubric: {
      criteria: `Evaluate based on:
1. Decision Correctness: Does the decision (yes/no/conditional) match the expected outcome?
2. Reasoning Quality: Does the response consider safety buffer, upcoming commitments, and impact on balance?
3. Risk Assessment: Does it appropriately flag risks (buffer violations, tight margins)?
4. Helpful Guidance: For conditional responses, does it provide actionable suggestions?`,
      scale:
        '0-5 scale where 5 = correct decision with comprehensive reasoning, 0 = completely incorrect decision',
      examples: [
        {
          score: 5,
          reasoning:
            'Correct decision with comprehensive reasoning including buffer consideration and upcoming commitments',
        },
        {
          score: 4,
          reasoning: 'Correct decision with good reasoning but minor omissions',
        },
        {
          score: 3,
          reasoning:
            'Correct decision but reasoning lacks important factors like buffer or commitments',
        },
        {
          score: 2,
          reasoning: 'Partially correct (e.g., yes vs conditional_yes mismatch) or weak reasoning',
        },
        {
          score: 1,
          reasoning: 'Incorrect decision but shows some understanding of factors',
        },
        {
          score: 0,
          reasoning: 'Completely incorrect decision with no consideration of key factors',
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
