/**
 * Buffer/Commitment Consideration Metric
 */

import type { DatasetItem, SingleTurnMetricDef } from '@tally-evals/tally';
import { defineBaseMetric, defineSingleTurnLLM } from '@tally-evals/tally';
import { extractInputOutput } from '@tally-evals/tally/metrics';
import { createIdentityNormalizer } from '@tally-evals/tally/normalization';
import type { LanguageModel } from 'ai';

export interface BufferConsiderationMetadata {
  shouldMentionBuffer: boolean;
  shouldMentionUpcomingBills: boolean;
  safetyBuffer?: number;
  upcomingCommitments?: Array<{
    name: string;
    amount: number;
    date?: string;
  }>;
  additionalFactors?: string[];
}

export interface BufferConsiderationOptions {
  provider: LanguageModel;
  mentionType?: 'explicit' | 'implicit';
}

export function createBufferConsiderationMetric(
  options: BufferConsiderationOptions
): SingleTurnMetricDef<number, DatasetItem> {
  const { provider, mentionType = 'explicit' } = options;

  const base = defineBaseMetric({
    name: 'bufferCommitmentConsideration',
    valueType: 'number',
    description:
      'Measures whether the assistant mentions and considers safety buffer and upcoming commitments',
    metadata: {
      mentionType,
    },
  });

  const metric = defineSingleTurnLLM<number, DatasetItem>({
    base,
    provider,
    preProcessor: async (selected: DatasetItem) => {
      const { input, output } = extractInputOutput(selected);

      const metadata = selected.metadata as BufferConsiderationMetadata | undefined;

      const shouldMentionBuffer = metadata?.shouldMentionBuffer ?? false;
      const shouldMentionBills = metadata?.shouldMentionUpcomingBills ?? false;
      const bufferAmount = String(metadata?.safetyBuffer ?? 0);
      const upcomingCommitments = metadata?.upcomingCommitments ?? [];
      const additionalFactors = metadata?.additionalFactors ?? [];

      return {
        input,
        output,
        shouldMentionBuffer: String(shouldMentionBuffer),
        shouldMentionBills: String(shouldMentionBills),
        bufferAmount,
        upcomingCommitments: JSON.stringify(upcomingCommitments, null, 2),
        additionalFactors: additionalFactors.join(', '),
        mentionType,
      };
    },
    prompt: {
      instruction: `You are evaluating whether an AI assistant properly considers and mentions important cashflow factors like safety buffer and upcoming commitments.

User Query:
{{input}}

Assistant Response:
{{output}}

Context:
- Safety Buffer: {{bufferAmount}}
- Upcoming Commitments: {{upcomingCommitments}}
- Additional Factors: {{additionalFactors}}

Ground Truth:
- Should mention buffer: {{shouldMentionBuffer}}
- Should mention upcoming bills: {{shouldMentionBills}}
- Mention type required: {{mentionType}}

Evaluate whether the assistant appropriately considers these factors:

For EXPLICIT mention: The assistant must directly mention "buffer", "safety buffer", or similar terms when shouldMentionBuffer is true. Must mention "upcoming bills", "commitments", or specific bill names when shouldMentionBills is true.

For IMPLICIT consideration: The reasoning should reflect awareness of these factors even if not explicitly named.

Provide a score between 0 and 1:
- 1.0: Mentions all required factors appropriately
- 0.75: Mentions most required factors
- 0.5: Mentions some factors but misses important ones
- 0.25: Minimal consideration
- 0.0: Does not mention or consider any relevant factors`,
      variables: [] as const,
    },
    normalization: {
      normalizer: createIdentityNormalizer(),
    },
  });

  return metric as SingleTurnMetricDef<number, DatasetItem>;
}
