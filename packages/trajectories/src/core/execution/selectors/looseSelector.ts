/**
 * Loose selector - LLM-based step selection with confidence gating
 */

import { generateObject } from 'ai';
import { z } from 'zod';
import type { ModelMessage, LanguageModel } from 'ai';
import type { StepDefinition, StepsSnapshot, StepSelectorResult, StepId } from '../../steps/types.js';
import type { StepRanker } from '../stepRanker.js';
import { getEligibleSteps } from '../eligibility.js';

export interface LooseSelectorConfig {
	ranker?: StepRanker;
	userModel?: LanguageModel;
	scoreThreshold?: number; // Default: 0.5
	margin?: number; // Default: 0.1
	fallback?: 'sequential' | 'stay'; // Default: 'sequential'
}

/**
 * Default LLM-based ranker implementation
 */
class DefaultLLMRanker implements StepRanker {
	constructor(private model: LanguageModel) {}

	async rank(args: {
		history: readonly ModelMessage[];
		goal: string;
		steps: readonly StepDefinition[];
	}): Promise<Array<{ stepId: StepId; score: number; reasons?: string[] }>> {
		const { history, goal, steps } = args;

		// Extract last assistant message
		const lastAssistant = [...history].reverse().find((msg) => msg.role === 'assistant');
		const agentMessage = lastAssistant
			? typeof lastAssistant.content === 'string'
				? lastAssistant.content
				: '[complex content]'
			: '';

		if (steps.length === 0) {
			return [];
		}

		// Create step list for prompt
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

		const prompt = `You analyze a conversation and decide which single user step best fits the assistant's latest question. Return the best match and also the top 3 candidates with confidence scores.

Assistant message:
"${agentMessage}"

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
				model: this.model,
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

			// Build ranked results
			const ranked: Array<{ stepId: StepId; score: number; reasons?: string[] }> = [];

			// Add top candidates
			for (const candidate of candidates) {
				if (
					typeof candidate.stepIndex === 'number' &&
					candidate.stepIndex >= 0 &&
					candidate.stepIndex < steps.length
				) {
					const step = steps[candidate.stepIndex];
					if (step) {
						ranked.push({
							stepId: step.id,
							score: candidate.confidence ?? 0,
							reasons: [candidate.reasoning],
						});
					}
				}
			}

			// If matchedIndex is set and not already in ranked, add it
			if (
				matchedIndex !== null &&
				typeof matchedIndex === 'number' &&
				matchedIndex >= 0 &&
				matchedIndex < steps.length
			) {
				const step = steps[matchedIndex];
				if (step && !ranked.find((r) => r.stepId === step.id)) {
					ranked.push({
						stepId: step.id,
						score: 0.5, // Default score if not in candidates
						reasons: [result.object.reasoning],
					});
				}
			}

			return ranked;
		} catch (error) {
			// If ranking fails, return empty
			console.warn('Step ranking failed:', error);
			return [];
		}
	}
}

/**
 * Loose selector implementation
 * Uses LLM to rank eligible steps and selects based on confidence threshold
 */
export async function looseSelect(
	snapshot: StepsSnapshot,
	history: readonly ModelMessage[],
	goal: string,
	config: LooseSelectorConfig
): Promise<StepSelectorResult> {
	const eligible = await getEligibleSteps(snapshot, history);

	if (eligible.length === 0) {
		return {
			candidates: [],
			chosen: null,
		};
	}

	// Get ranker (use default if not provided)
	const ranker =
		config.ranker ||
		(config.userModel ? new DefaultLLMRanker(config.userModel) : null);

	if (!ranker) {
		// No ranker available, use fallback
		return handleFallback(snapshot, eligible, config);
	}

	// Rank eligible steps
	const ranked = await ranker.rank({
		history,
		goal,
		steps: eligible,
	});

	if (ranked.length === 0) {
		return handleFallback(snapshot, eligible, config);
	}

	// Sort by score descending
	ranked.sort((a, b) => b.score - a.score);

	const threshold = config.scoreThreshold ?? 0.5;
	const margin = config.margin ?? 0.1;
	const topCandidate = ranked[0];

	// Safety check (should never happen after length check, but TypeScript needs it)
	if (!topCandidate) {
		return handleFallback(snapshot, eligible, config);
	}

	// Check confidence threshold
	if (topCandidate.score < threshold) {
		return handleFallback(snapshot, eligible, config);
	}

	// Check margin (difference between top and second)
	if (ranked.length > 1) {
		const secondCandidate = ranked[1];
		if (secondCandidate) {
			const scoreDiff = topCandidate.score - secondCandidate.score;
			if (scoreDiff < margin) {
				// Too close, use fallback
				return handleFallback(snapshot, eligible, config);
			}
		}
	}

	return {
		candidates: ranked,
		chosen: topCandidate.stepId,
	};
}

/**
 * Handle fallback when LLM ranking is unavailable or confidence is low
 */
function handleFallback(
	snapshot: StepsSnapshot,
	eligible: StepDefinition[],
	config: LooseSelectorConfig
): StepSelectorResult {
	const fallback = config.fallback ?? 'sequential';

	if (fallback === 'stay') {
		// Stay on current step if it's eligible
		if (snapshot.current) {
			const currentStep = eligible.find((s) => s.id === snapshot.current);
			if (currentStep) {
				return {
					candidates: [
						{
							stepId: currentStep.id,
							score: 0.5,
							reasons: ['Fallback: staying on current step'],
						},
					],
					chosen: currentStep.id,
				};
			}
		}
	}

	// Sequential fallback: pick first eligible step in graph order
	const stepOrder = snapshot.graph.steps.map((s) => s.id);
	const currentIndex = snapshot.current
		? stepOrder.indexOf(snapshot.current)
		: stepOrder.indexOf(snapshot.graph.start);

	// Find next eligible step
	for (let i = currentIndex + 1; i < stepOrder.length; i++) {
		const stepId = stepOrder[i];
		const step = eligible.find((s) => s.id === stepId);
		if (step) {
			return {
				candidates: [
					{
						stepId: step.id,
						score: 0.5,
						reasons: ['Fallback: sequential selection'],
					},
				],
				chosen: step.id,
			};
		}
	}

	// If no next step, try start
	if (currentIndex === -1) {
		const startStep = eligible.find((s) => s.id === snapshot.graph.start);
		if (startStep) {
			return {
				candidates: [
					{
						stepId: startStep.id,
						score: 0.5,
						reasons: ['Fallback: starting from first step'],
					},
				],
				chosen: startStep.id,
			};
		}
	}

	return {
		candidates: [],
		chosen: null,
	};
}

