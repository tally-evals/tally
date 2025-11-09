/**
 * Role Adherence Metric
 * 
 * An LLM-based multi-turn metric that measures how well the assistant adheres to a specified role
 * across an entire conversation. Uses LLM-based analysis to score role adherence on a 0-5 scale,
 * which is then normalized to a 0-1 Score using a min-max normalizer.
 * 
 * Works with Conversation containers only.
 */

import { defineBaseMetric, createMultiTurnLLM } from '@tally/core/factory';
import { createMinMaxNormalizer } from '@tally/core/normalization/factory';
import type { MultiTurnMetricDef, Conversation } from '@tally/core/types';
import type { LanguageModel } from 'ai';
import { extractTextFromMessage, extractTextFromMessages } from '../common/utils';

export interface RoleAdherenceOptions {
	/**
	 * Expected role description (required)
	 * Describes the role the assistant should adhere to (e.g., "friendly customer service agent", "technical expert")
	 */
	expectedRole: string;
	/**
	 * LLM provider for role adherence analysis (required)
	 */
	provider: LanguageModel;
	/**
	 * Check consistency across all turns (default: true)
	 * If true, evaluates whether the assistant maintains role consistency throughout the conversation
	 */
	checkConsistency?: boolean;
}

/**
 * Create a role adherence metric
 * 
 * Measures how well the assistant adheres to a specified role across an entire conversation.
 * Returns a score 0-5 which is normalized to 0-1 Score using a min-max normalizer.
 * 
 * Scoring Process:
 * 1. The LLM analyzes all conversation steps to understand the assistant's behavior
 * 2. The LLM evaluates how well the assistant adheres to the expected role
 * 3. If consistency checking is enabled, evaluates role consistency across turns
 * 4. Score Calculation: LLM returns a score 0-5 based on role adherence
 * 5. Normalization: Min-max normalizer converts 0-5 to 0-1 Score
 * 
 * Score Interpretation (0-5 scale):
 * - 5.0: Assistant perfectly adheres to the role throughout the conversation
 * - 4.0-4.9: Assistant mostly adheres to the role with minor deviations
 * - 3.0-3.9: Assistant partially adheres to the role but has noticeable deviations
 * - 2.0-2.9: Assistant occasionally adheres to the role but frequently deviates
 * - 1.0-1.9: Assistant rarely adheres to the role
 * - 0.0-0.9: Assistant does not adhere to the role at all
 * 
 * @param options - Configuration options
 * @returns A multi-turn metric definition for role adherence
 */
export function createRoleAdherenceMetric(
	options: RoleAdherenceOptions
): MultiTurnMetricDef<number, Conversation> {
	const { expectedRole, provider, checkConsistency = true } = options;

	const base = defineBaseMetric({
		name: 'roleAdherence',
		valueType: 'number',
		description:
			'Measures how well the assistant adheres to a specified role across an entire conversation',
		metadata: {
			expectedRole,
			checkConsistency,
		},
	});

	const metric = createMultiTurnLLM<number>({
		base,
		provider,
		runOnContainer: async (conversation) => {
			// Prepare conversation data for the prompt
			// Extract text from all steps for easier analysis
			const conversationText = conversation.steps
				.map((step, index) => {
					const userText = extractTextFromMessage(step.input);
					const assistantText = extractTextFromMessages(step.output);
					return `Turn ${index + 1}:\nUser: ${userText}\nAssistant: ${assistantText}`;
				})
				.join('\n\n');

			return {
				conversationText,
				stepCount: conversation.steps.length,
			};
		},
		prompt: {
			instruction: `You are evaluating how well an assistant adheres to a specified role throughout a conversation.

Given the expected role and the conversation below, analyze the assistant's adherence to the role using the provided rubric.${checkConsistency ? '\n\nPay special attention to consistency - evaluate whether the assistant maintains the role consistently across all turns.' : ''}

Rubric:
{{rubric}}

Expected Role: {{expectedRole}}

Conversation:
{{conversationText}}

Based on your analysis and the rubric, provide your score as a number between 0 and 5.`,
			variables: [] as const,
		},
		rubric: {
			criteria: `Evaluate role adherence based on:
1. How well the assistant's language, tone, and behavior match the expected role
2. Consistency of role adherence across all conversation turns${checkConsistency ? ' (required)' : ' (if applicable)'}
3. Appropriateness of responses given the role context
4. Avoidance of behaviors that contradict the expected role`,
			scale: '0-5 scale where 5 = perfect adherence, 0 = no adherence',
			examples: [
				{
					score: 5,
					reasoning: 'Assistant perfectly adheres to the role throughout the conversation with consistent behavior and appropriate responses',
				},
				{
					score: 4,
					reasoning: 'Assistant mostly adheres to the role with minor deviations or occasional inconsistencies',
				},
				{
					score: 3,
					reasoning: 'Assistant partially adheres to the role but has noticeable deviations or inconsistencies',
				},
				{
					score: 2,
					reasoning: 'Assistant occasionally adheres to the role but frequently deviates or shows inconsistency',
				},
				{
					score: 1,
					reasoning: 'Assistant rarely adheres to the role and shows significant deviations',
				},
				{
					score: 0,
					reasoning: 'Assistant does not adhere to the role at all and behaves in ways that contradict the expected role',
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

	// Type assertion: createMultiTurnLLM always returns a multi-turn metric
	return metric as MultiTurnMetricDef<number, Conversation>;
}

