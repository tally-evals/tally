/**
 * Completeness Metric
 *
 * An LLM-based single-turn metric that measures how complete an answer is relative to expected coverage.
 * Uses LLM-based analysis to score responses on a 0-5 scale, which is then normalized to a 0-1 Score.
 *
 * Supports both DatasetItem and ConversationStep containers.
 */

import { defineSingleTurnLLM, defineBaseMetric } from '../../core/primitives';
import { createMinMaxNormalizer } from '../../normalizers/factories';
import type {
  NumericAggregatorDef,
  SingleTurnContainer,
  SingleTurnMetricDef,
} from '@tally/core/types';
import type { LanguageModel } from 'ai';

export interface CompletenessOptions {
  /**
   * LLM provider for completeness analysis (required)
   */
  provider: LanguageModel;
  /**
   * Expected key points/topics (optional)
   * If provided, these will be included in the prompt to guide the LLM's evaluation
   */
  expectedPoints?: string[];
  /**
   * Aggregators to apply to the metric
   * @default Percentiles: 50, 75, 90
   */
  aggregators?: NumericAggregatorDef[];
}

/**
 * Create a completeness metric
 *
 * Measures how complete an answer is relative to expected coverage using LLM-based analysis.
 * Returns a score 0-5 which is normalized to 0-1 Score using a min-max normalizer.
 *
 * Scoring Process:
 * 1. The LLM analyzes the input query/prompt to identify what topics/points should be covered
 * 2. The LLM evaluates the output response to determine how many expected points are covered
 * 3. Score Calculation: LLM returns a score 0-5 based on completeness
 * 4. Normalization: Min-max normalizer converts 0-5 to 0-1 Score
 *
 * Score Interpretation (0-5 scale):
 * - 5.0: Response fully covers all expected topics/points comprehensively
 * - 4.0-4.9: Response covers most expected points, minor gaps or incomplete coverage
 * - 3.0-3.9: Response covers some expected points but misses several important aspects
 * - 2.0-2.9: Response covers few expected points, significant gaps in coverage
 * - 1.0-1.9: Response covers minimal expected points, largely incomplete
 * - 0.0-0.9: Response does not cover expected points, entirely incomplete
 *
 * @param options - Configuration options
 * @returns A single-turn metric definition for completeness
 */
export function createCompletenessMetric<
  TContainer extends SingleTurnContainer = SingleTurnContainer,
>(options: CompletenessOptions): SingleTurnMetricDef<number, TContainer> {
  const { provider, expectedPoints, aggregators } = options;

  const base = defineBaseMetric({
    name: 'completeness',
    valueType: 'number',
    description:
      'Measures how complete an answer is relative to expected coverage using LLM-based analysis',
  });

  // Format expected points as a string variable
  const formattedExpectedPoints =
    expectedPoints && expectedPoints.length > 0
      ? expectedPoints.map((p, i) => `${i + 1}. ${p}`).join('\n')
      : '';

  const metric = defineSingleTurnLLM<number, TContainer>({
    ...(aggregators !== undefined && { aggregators }),
    base,
    provider,
    prompt: {
      instruction: `You are evaluating how complete a response is relative to what is expected from the query.

Given the query and response below, analyze the response's completeness using the provided rubric.${
        formattedExpectedPoints
          ? `\n\nExpected topics/points that should be covered:\n${formattedExpectedPoints}`
          : ''
      }

Rubric:
{{rubric}}

Query: {{input}}
Response: {{output}}

Based on your analysis and the rubric, provide your score as a number between 0 and 5.`,
      variables: [] as const,
    },
    rubric: {
      criteria: `Evaluate completeness based on:
1. Coverage of expected topics/points from the query
2. Depth and thoroughness of coverage
3. Presence of gaps or missing information`,
      scale: '0-5 scale where 5 = fully complete, 0 = entirely incomplete',
      examples: [
        {
          score: 5,
          reasoning:
            'Response fully covers all expected topics comprehensively with thorough detail',
        },
        {
          score: 4,
          reasoning:
            'Response covers most expected points but has minor gaps or incomplete coverage in some areas',
        },
        {
          score: 3,
          reasoning: 'Response covers some expected points but misses several important aspects',
        },
        {
          score: 2,
          reasoning: 'Response covers few expected points with significant gaps in coverage',
        },
        {
          score: 1,
          reasoning: 'Response covers minimal expected points and is largely incomplete',
        },
        {
          score: 0,
          reasoning: 'Response does not cover expected points and is entirely incomplete',
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

  // Type assertion: defineSingleTurnLLM always returns a single-turn metric
  return metric as SingleTurnMetricDef<number, TContainer>;
}
