/**
 * Answer Relevance Metric
 * 
 * An LLM-based single-turn metric that measures how relevant the output is to the input query.
 * Uses statement-level relevance analysis to score responses on a 0-5 scale, which is then
 * normalized to a 0-1 Score using a min-max normalizer.
 * 
 * Supports both DatasetItem and ConversationStep containers.
 */

import { defineBaseMetric, createSingleTurnLLM } from '@tally/core/factory';
import { createMinMaxNormalizer } from '@tally/core/normalization/factory';
import type { SingleTurnMetricDef, SingleTurnContainer } from '@tally/core/types';
import type { LanguageModel } from 'ai';

export interface AnswerRelevanceOptions {
	/**
	 * LLM provider for relevance analysis (required)
	 */
	provider: LanguageModel;
	/**
	 * Partial weight for "unsure" statements (default: 0.3)
	 * This is used in the scoring rubric to guide the LLM
	 */
	partialWeight?: number;
}

/**
 * Create an answer relevance metric
 * 
 * Measures how relevant the output is to the input query using LLM-based
 * statement-level relevance analysis. Returns a score 0-5 which is normalized
 * to 0-1 Score using a min-max normalizer.
 * 
 * Scoring Process:
 * 1. Statement Preprocessing: Breaks output into meaningful statements while preserving context
 * 2. Relevance Analysis: Each statement evaluated as "yes" (full weight), "unsure" (partial weight), or "no" (zero weight)
 * 3. Score Calculation: LLM returns a score 0-5 based on overall relevance
 * 4. Normalization: Min-max normalizer converts 0-5 to 0-1 Score
 * 
 * Score Interpretation (0-5 scale):
 * - 5.0: Response fully answers the query with relevant and focused information
 * - 4.0-4.9: Response mostly answers but may include minor unrelated content
 * - 3.0-3.9: Response partially answers, mixing relevant and unrelated information
 * - 2.0-2.9: Response includes minimal relevant content, largely misses intent
 * - 1.0-1.9: Response has very little relevance to the query
 * - 0.0-0.9: Response is entirely unrelated and does not answer the query
 * 
 * @param options - Configuration options
 * @returns A single-turn metric definition for answer relevance
 */
export function createAnswerRelevanceMetric<TContainer extends SingleTurnContainer = SingleTurnContainer>(
	options: AnswerRelevanceOptions
): SingleTurnMetricDef<number, TContainer> {
	const { provider, partialWeight = 0.3 } = options;

	const base = defineBaseMetric({
		name: 'answerRelevance',
		valueType: 'number',
		description:
			'Measures how relevant the output is to the input query using LLM-based statement-level relevance analysis',
	});

	const metric = createSingleTurnLLM<number, TContainer>({
		base,
		provider,
		prompt: {
			instruction: `You are evaluating how relevant a response is to a given query.

Given the query and response below, analyze the response's relevance to the query using the provided rubric.

Rubric:
{{rubric}}

Query: {{input}}
Response: {{output}}

Based on your analysis and the rubric, provide your score as a number between 0 and 5.`,
			variables: [] as const,
		},
		rubric: {
			criteria: `Evaluate relevance based on:
1. Direct answer to the query (full weight)
2. Partial relevance with some unrelated content (partial weight: ${partialWeight})
3. No relevance to the query (zero weight)`,
			scale: '0-5 scale where 5 = fully relevant, 0 = entirely unrelated',
			examples: [
				{
					score: 5,
					reasoning: 'Response directly and completely answers the query with focused, relevant information',
				},
				{
					score: 4,
					reasoning: 'Response mostly answers the query but includes minor unrelated content',
				},
				{
					score: 3,
					reasoning: 'Response partially answers the query, mixing relevant and unrelated information',
				},
				{
					score: 2,
					reasoning: 'Response includes minimal relevant content and largely misses the intent',
				},
				{
					score: 1,
					reasoning: 'Response has very little relevance to the query',
				},
				{
					score: 0,
					reasoning: 'Response is entirely unrelated and does not answer the query',
				},
			],
		},
		normalization: {
			default: createMinMaxNormalizer({
				min: 0,
				max: 5,
				clip: true,
			}),
		},
	});

	// Type assertion: createSingleTurnLLM always returns a single-turn metric
	return metric as SingleTurnMetricDef<number, TContainer>;
}
