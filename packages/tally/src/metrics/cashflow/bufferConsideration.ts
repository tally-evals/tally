/**
 * Buffer/Commitment Consideration Metric
 *
 * An LLM-based single-turn metric that measures whether the assistant mentions
 * and considers safety buffer and upcoming commitments when answering affordability
 * questions.
 *
 * Evaluates the quality of explanation and whether important factors (buffer,
 * upcoming bills) are explicitly mentioned when relevant.
 *
 * Supports DatasetItem with metadata indicating which factors should be mentioned.
 */

import type { DatasetItem, SingleTurnMetricDef } from '@tally/core/types';
import type { LanguageModel } from 'ai';
import { defineBaseMetric, defineSingleTurnLLM } from '../../core/primitives';
import { createIdentityNormalizer } from '../../normalizers/factories';
import { extractInputOutput } from '../common/utils';

/**
 * Metadata structure for buffer/commitment consideration evaluation
 */
export interface BufferConsiderationMetadata {
  /**
   * Whether the assistant should mention the safety buffer
   */
  shouldMentionBuffer: boolean;
  /**
   * Whether the assistant should mention upcoming bills/commitments
   */
  shouldMentionUpcomingBills: boolean;
  /**
   * Current safety buffer amount
   */
  safetyBuffer?: number;
  /**
   * Upcoming commitments
   */
  upcomingCommitments?: Array<{
    name: string;
    amount: number;
    date?: string;
  }>;
  /**
   * Additional context factors that should be mentioned
   */
  additionalFactors?: string[];
}

export interface BufferConsiderationOptions {
  /**
   * LLM provider for evaluation
   */
  provider: LanguageModel;
  /**
   * Require explicit mention or just implicit consideration
   * @default 'explicit'
   */
  mentionType?: 'explicit' | 'implicit';
}

/**
 * Create a buffer/commitment consideration metric
 *
 * Measures whether the assistant mentions and considers safety buffer and
 * upcoming commitments when evaluating affordability.
 *
 * Scoring (0-1 scale):
 * - 1.0: Mentions all relevant factors (buffer, upcoming bills) explicitly
 * - 0.75-0.99: Mentions most relevant factors
 * - 0.5-0.74: Mentions some factors but misses important ones
 * - 0.25-0.49: Minimal consideration of factors
 * - 0.0: Does not mention or consider any relevant factors
 *
 * @param options - Configuration options
 * @returns A single-turn metric definition for buffer/commitment consideration
 */
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

      // Extract metadata
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
