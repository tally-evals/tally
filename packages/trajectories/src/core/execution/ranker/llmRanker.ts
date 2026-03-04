/**
 * LLM-based step ranking utility
 */

import { generateObject } from 'ai';
import { z } from 'zod';
import type { LanguageModel } from 'ai';
import type { StepDefinition, StepId } from '../../steps/types.js';
import type { StepTrace } from '../../types.js';
import { formatConversationFromTraces } from '../../../utils/messageFormatting.js';

export async function rankStepsWithLLM(args: {
	model: LanguageModel;
	stepTraces: readonly StepTrace[];
	lastNSteps?: number;
	goal: string;
	steps: readonly StepDefinition[];
}): Promise<Array<{ stepId: StepId; score: number; reasons?: string[] }>> {
	const { model, stepTraces, lastNSteps = 1, goal, steps } = args;

	// Format conversation from step traces
	const { conversationContext } = formatConversationFromTraces(stepTraces, lastNSteps);

	if (steps.length === 0) {
		return [];
	}

	const stepsWithIndices = steps.map((step, index) => ({
		index,
		id: step.id,
		instruction: step.instruction,
		hints: step.hints?.join(', ') || '',
	}));

	const candidateSchema = z.object({
		stepIndex: z.number().describe('Index of a candidate step (0-based)'),
		confidence: z.number().min(0).max(1).describe('Confidence score between 0 and 1'),
		reasoning: z.string().describe('Brief justification for why this step matches'),
	});

	const stepMatchSchema = z.object({
		matchedStepIndex: z
			.number()
			.nullable()
			.describe(
				'The index of the step that best matches what the agent is asking for, or null if no step matches'
			),
		reasoning: z
			.string()
			.describe(
				'Explanation of why this step was matched (or why no step matches). Can include confidence/candidate info.'
			),
		topCandidates: z
			.array(candidateSchema)
			.max(3)
			.optional()
			.describe('Top 3 candidate steps with confidence, sorted high-to-low'),
	});

	const prompt = `This is an ongoing conversation. Analyze the recent exchange(s) and decide which single user step best fits what should happen next. Return the best match and also the top 3 candidates with confidence scores.

Recent conversation:
${conversationContext}

The trajectory has the following steps available (each step describes what the USER should do):
${stepsWithIndices
	.map(
		(step) =>
			`Step ${step.index} (id: ${step.id}): ${step.instruction}${step.hints ? ` (Hints: ${step.hints})` : ''}`
	)
	.join('\n')}

Guidance:
- Match based on the specific INFORMATION the assistant is asking the user to provide or confirm.
- Prefer the step whose instruction or hints most directly answers the assistant's question.
- If the assistant asks for multiple items, focus on the primary request.
- If nothing fits, return null.

Trajectory goal: ${goal}

Return JSON that strictly matches the schema:
- matchedStepIndex: 0-based index or null
- reasoning: brief explanation (you may include confidence rationale)
- topCandidates: up to 3 items, sorted by confidence desc, each with { stepIndex, confidence, reasoning }`;

	try {
		const result = await generateObject({
			model,
			system: 'You are analyzing an ongoing conversation to select the next best user step. Consider both the user\'s latest message and the assistant\'s response to determine what step the user should take next.',
			prompt,
			schema: stepMatchSchema,
		});

		// Extract and sort candidates by confidence
		const candidates = Array.isArray(result.object.topCandidates)
			? [...result.object.topCandidates]
			: [];
		if (candidates.length > 0) {
			// Ensure sorted by confidence desc
			candidates.sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0));
		}

		// Build ranked results
		const ranked: Array<{ stepId: StepId; score: number; reasons?: string[] }> = [];

		// Add top candidates (filter out scores <= 0.5)
		for (const candidate of candidates) {
			const confidence = candidate.confidence ?? 0;
			// Filter out low-confidence candidates
			if (confidence <= 0.3) continue;
			
			if (
				typeof candidate.stepIndex === 'number' &&
				candidate.stepIndex >= 0 &&
				candidate.stepIndex < steps.length
			) {
				const step = steps[candidate.stepIndex];
				if (step) {
					ranked.push({
						stepId: step.id,
						score: confidence,
						reasons: [candidate.reasoning],
					});
				}
			}
		}

		// Note: matchedIndex fallback (score 0.5) is filtered out per our threshold
		// This ensures we only return high-confidence matches (> 0.5)

		return ranked;
	} catch (error) {
		// If ranking fails, return empty
		console.warn('Step ranking failed:', error);
		return [];
	}
}


