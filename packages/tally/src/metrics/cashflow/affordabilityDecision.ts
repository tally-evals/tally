/**
 * Affordability Decision Accuracy Metric
 *
 * An LLM-based single-turn metric that measures whether the assistant correctly
 * determines if a purchase or expense is affordable based on the cashflow state.
 *
 * Evaluates the correctness of yes/no/conditional affordability decisions,
 * considering balance, safety buffer, and upcoming commitments.
 *
 * Supports DatasetItem with metadata containing cashflow state and expected decision.
 */

import type { DatasetItem, SingleTurnMetricDef } from '@tally/core/types';
import type { LanguageModel } from 'ai';
import { defineBaseMetric, defineSingleTurnLLM } from '../../core/primitives';
import { createMinMaxNormalizer } from '../../normalizers/factories';
import { extractInputOutput } from '../common/utils';

/**
 * Affordability decision types
 */
export type AffordabilityDecision = 'yes' | 'no' | 'conditional_yes' | 'conditional_no';

/**
 * Metadata structure for affordability decision evaluation
 */
export interface AffordabilityDecisionMetadata {
  /**
   * Expected decision (ground truth)
   */
  expectedDecision: AffordabilityDecision;
  /**
   * Current balance
   */
  currentBalance?: number;
  /**
   * Safety buffer amount
   */
  safetyBuffer?: number;
  /**
   * Projected minimum balance after the expense
   */
  projectedMinBalance?: number;
  /**
   * Upcoming commitments/bills (name and amount)
   */
  upcomingCommitments?: Array<{
    name: string;
    amount: number;
    date?: string;
  }>;
  /**
   * Requested expense amount
   */
  requestedAmount?: number;
  /**
   * Expected reasoning for the decision
   */
  expectedReasoning?: string[];
}

export interface AffordabilityDecisionOptions {
  /**
   * LLM provider for evaluation
   */
  provider: LanguageModel;
  /**
   * Weight for decision correctness vs reasoning quality
   * @default { decision: 0.7, reasoning: 0.3 }
   */
  weights?: {
    decision: number;
    reasoning: number;
  };
}

/**
 * Create an affordability decision accuracy metric
 *
 * Measures whether the assistant correctly determines affordability.
 * Evaluates both the decision (yes/no/conditional) and the reasoning provided.
 *
 * Scoring (0-5 scale, normalized to 0-1):
 * - 5: Correct decision with comprehensive reasoning (buffer, commitments, etc.)
 * - 4: Correct decision with good reasoning but minor omissions
 * - 3: Correct decision but reasoning lacks important factors
 * - 2: Partially correct (e.g., yes vs conditional_yes mismatch)
 * - 1: Incorrect decision but shows some understanding
 * - 0: Completely incorrect decision
 *
 * @param options - Configuration options
 * @returns A single-turn metric definition for affordability decision accuracy
 */
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

      // Extract metadata
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
