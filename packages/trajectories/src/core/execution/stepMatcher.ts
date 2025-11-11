/**
 * Step matcher for loose mode - matches agent questions to relevant steps
 */

import { generateObject } from 'ai';
import { z } from 'zod';
import type { ModelMessage, LanguageModel } from 'ai';
import type { Trajectory, TrajectoryStep } from '../types.js';

export interface StepMatchResult {
	matchedStepIndex: number | null;
	matchedStep: TrajectoryStep | null;
	reasoning: string;
}

/**
 * Match the agent's last message to the most relevant step in the trajectory
 * 
 * @param agentMessage - The last message from the agent
 * @param trajectory - The trajectory definition
 * @param model - AI SDK model function to use for matching
 * @returns The matched step index and step, or null if no match
 */
export async function matchStepToAgentQuestion(
	agentMessage: string,
	trajectory: Trajectory,
	model: LanguageModel
): Promise<StepMatchResult> {
	// If no steps defined, return no match
	if (!trajectory.steps || trajectory.steps.length === 0) {
		return {
			matchedStepIndex: null,
			matchedStep: null,
			reasoning: 'No steps defined in trajectory',
		};
	}

	// Create a list of available steps with their indices
	const stepsWithIndices = trajectory.steps.map((step, index) => ({
		index,
		instruction: step.instruction,
		requiredInfo: step.requiredInfo?.join(', ') || '',
	}));

	// Candidate schema and step matching schema (includes top-k for internal selection)
	const candidateSchema = z.object({
		stepIndex: z
			.number()
			.describe('Index of a candidate step (0-based)'),
		confidence: z
			.number()
			.min(0)
			.max(1)
			.describe('Confidence score between 0 and 1'),
		reasoning: z
			.string()
			.describe('Brief justification for why this step matches'),
	});

	const stepMatchSchema = z.object({
		// Kept for compatibility with callers
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
		// New internal field: top candidates with confidence (up to 3)
		topCandidates: z
			.array(candidateSchema)
			.max(3)
			.optional()
			.describe('Top 3 candidate steps with confidence, sorted high-to-low'),
	});

	const prompt = `You analyze a conversation and decide which single user step best fits the assistant's latest question. Return the best match and also the top 3 candidates with confidence scores.

Assistant message:
"${agentMessage}"

The trajectory has the following steps available (each step describes what the USER should do):
${stepsWithIndices
	.map(
		(step) =>
			`Step ${step.index}: ${step.instruction}${step.requiredInfo ? ` (User provides: ${step.requiredInfo})` : ''}`
	)
	.join('\n')}

Guidance:
- Match based on the specific INFORMATION the assistant is asking the user to provide or confirm.
- Prefer the step whose requiredInfo or instruction most directly answers the assistant's question.
- If the assistant asks for multiple items, focus on the primary request.
- If nothing fits, return null.

Multi-domain few-shot examples:

Example A (Travel):
- Assistant: "What is your departure date?"
- Steps: 0) Provide origin city, 1) Provide departure date, 2) Confirm round trip
- Best match: index 1. Top candidates might be: [1 (0.86), 0 (0.10), 2 (0.04)]

Example B (E‑commerce return):
- Assistant: "Could you share your order number?"
- Steps: 0) Provide order number, 1) Describe issue, 2) Choose refund or replacement
- Best match: index 0. Top candidates might be: [0 (0.88), 1 (0.08), 2 (0.04)]

Example C (Calendar scheduling):
- Assistant: "What day and time works for you?"
- Steps: 0) State meeting topic, 1) Provide preferred date/time, 2) Share location preference
- Best match: index 1. Top candidates might be: [1 (0.84), 2 (0.10), 0 (0.06)]

Trajectory goal: ${trajectory.goal}

Return JSON that strictly matches the schema:
- matchedStepIndex: 0-based index or null
- reasoning: brief explanation (you may include confidence rationale)
- topCandidates: up to 3 items, sorted by confidence desc, each with { stepIndex, confidence, reasoning }`;

	try {
		const result = await generateObject({
			model,
			prompt,
			schema: stepMatchSchema,
		});

		// Prefer topCandidates[0] if present; otherwise fall back to matchedStepIndex
		let matchedIndex = result.object.matchedStepIndex;
		const candidates = Array.isArray(result.object.topCandidates)
			? [...result.object.topCandidates]
			: [];
		if (candidates.length > 0) {
			// Ensure sorted by confidence desc
			candidates.sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0));
			if (typeof candidates[0]?.stepIndex === 'number') {
				matchedIndex = candidates[0].stepIndex;
			}
		}

		const matchedStep: TrajectoryStep | null =
			matchedIndex !== null && matchedIndex >= 0 && matchedIndex < trajectory.steps.length
				? trajectory.steps[matchedIndex] ?? null
				: null;

		return {
			matchedStepIndex: matchedIndex,
			matchedStep,
			reasoning: result.object.reasoning,
		};
	} catch (error) {
		// If matching fails, fall back to no match
		console.warn('Step matching failed:', error);
		return {
			matchedStepIndex: null,
			matchedStep: null,
			reasoning: `Matching failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
		};
	}
}

/**
 * Extract the last assistant message from history as a string
 */
export function extractLastAssistantMessage(
	history: readonly ModelMessage[]
): string | null {
	const lastAssistantMessage = history
		.slice()
		.reverse()
		.find((msg) => msg.role === 'assistant');

	if (!lastAssistantMessage) {
		return null;
	}

	if (typeof lastAssistantMessage.content === 'string') {
		return lastAssistantMessage.content;
	}

	// Handle structured content - try to extract text
	if (
		typeof lastAssistantMessage.content === 'object' &&
		Array.isArray(lastAssistantMessage.content)
	) {
		const textParts = lastAssistantMessage.content
			.filter((part) => part.type === 'text' && 'text' in part)
			.map((part) => (part as { text: string }).text);
		return textParts.length > 0 ? textParts.join('\n') : null;
	}

	return null;
}

