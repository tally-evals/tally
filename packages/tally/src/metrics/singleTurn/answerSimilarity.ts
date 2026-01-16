/**
 * Answer Similarity Metric
 *
 * A single-turn metric that measures how similar an answer is to a target response.
 * Supports both embedding-based similarity (using cosine similarity) and keyword-based matching.
 *
 * Supports both DatasetItem and ConversationStep containers.
 */

import { createSingleTurnCode, defineBaseMetric } from '@tally/core/factory';
import { createIdentityNormalizer } from '@tally/core/normalization/factory';
import type {
  NumericAggregatorDef,
  SingleTurnContainer,
  SingleTurnMetricDef,
} from '@tally/core/types';
import { extractWords } from '@tally/utils/text';
import type { EmbeddingModel } from 'ai';

export interface AnswerSimilarityOptions {
  /**
   * Embedding model for semantic similarity calculation (optional)
   * If provided, uses cosine similarity between embeddings
   * If not provided, falls back to keyword-based matching
   */
  embeddingModel?: EmbeddingModel;
  /**
   * Target response to compare against (optional)
   * If not provided, extracts from metadata.targetResponse
   */
  targetResponse?: string;
  /**
   * Minimum number of matching keywords required for similarity (only used for keyword-based)
   * @default 1
   */
  minKeywords?: number;
  /**
   * Aggregators to apply to the metric
   * @default Percentiles: 50, 75, 90
   */
  aggregators?: NumericAggregatorDef[];
}

/**
 * Create an answer similarity metric
 *
 * This metric computes similarity between the output and a target response.
 * If an embedding model is provided, uses cosine similarity between embeddings.
 * Otherwise, falls back to keyword-based matching.
 *
 * Supports both DatasetItem and ConversationStep containers.
 *
 * @param options - Configuration options
 * @returns A single-turn metric definition for answer similarity
 */
export function createAnswerSimilarityMetric<
  TContainer extends SingleTurnContainer = SingleTurnContainer,
>(options: AnswerSimilarityOptions = {}): SingleTurnMetricDef<number, TContainer> {
  const { embeddingModel, targetResponse, minKeywords = 1, aggregators } = options;

  const base = defineBaseMetric({
    name: 'answerSimilarity',
    valueType: 'number',
    description: embeddingModel
      ? 'Measures semantic similarity between answer and target response using embeddings'
      : 'Measures similarity between answer and target response using keyword matching',
  });

  const metric = createSingleTurnCode<number, TContainer>({
    ...(aggregators !== undefined && { aggregators }),
    base,
    compute: ({ data }) => {
      // Prepared payload provides normalized { input, output }
      const payload = data as { input?: string; output?: string } | undefined;
      const output = (payload?.output ?? '').toString();

      // Get target response
      let targetResp = targetResponse;
      if (!targetResp) {
        // Try to extract from metadata
        const metadata = (data as { metadata?: Record<string, unknown> }).metadata;
        if (metadata && typeof metadata.targetResponse === 'string') {
          targetResp = metadata.targetResponse;
        }
      }

      // If no target response, return 0
      if (!targetResp) {
        return 0;
      }

      // compute() is synchronous, so use keyword-based matching
      const outputWords = new Set(extractWords(output));
      const targetWords = new Set(extractWords(targetResp));

      // Count matching keywords
      let matches = 0;
      for (const word of targetWords) {
        if (outputWords.has(word)) {
          matches++;
        }
      }

      // Calculate similarity score
      if (targetWords.size === 0) {
        return 0.5;
      }

      const similarity = matches / targetWords.size;

      // Apply minimum keyword threshold
      if (matches < minKeywords) {
        return 0;
      }

      return Math.min(1, Math.max(0, similarity));
    },
    cacheable: true,
    normalization: {
      default: createIdentityNormalizer(),
    },
  });

  // Type assertion: createSingleTurnCode always returns a single-turn metric
  return metric as SingleTurnMetricDef<number, TContainer>;
}
