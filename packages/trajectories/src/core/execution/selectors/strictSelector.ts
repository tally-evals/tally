/**
 * Strict selector - deterministic step selection following graph order
 */

import type { StepDefinition, StepsSnapshot, StepSelectorResult } from '../../steps/types.js';
import type { ModelMessage } from 'ai';
import { getEligibleSteps } from '../eligibility.js';

/**
 * Strict selector implementation
 * Selects the next step in order that has preconditions satisfied
 */
export async function strictSelect(
	snapshot: StepsSnapshot,
	history: readonly ModelMessage[]
): Promise<StepSelectorResult> {
	const eligible = await getEligibleSteps(snapshot, history);

	if (eligible.length === 0) {
		return {
			candidates: [],
			chosen: null,
		};
	}

	// Find first eligible step in graph order
	const stepOrder = snapshot.graph.steps.map((s) => s.id);
	const currentIndex = snapshot.current
		? stepOrder.indexOf(snapshot.current)
		: stepOrder.indexOf(snapshot.graph.start);

	// Find next eligible step after current
	let nextStep: StepDefinition | null = null;
	for (let i = currentIndex + 1; i < stepOrder.length; i++) {
		const stepId = stepOrder[i];
		const step = eligible.find((s) => s.id === stepId);
		if (step) {
			nextStep = step;
			break;
		}
	}

	// If no next step found, check if we should start from beginning
	if (!nextStep && currentIndex === -1) {
		const startStep = eligible.find((s) => s.id === snapshot.graph.start);
		if (startStep) {
			nextStep = startStep;
		}
	}

	if (!nextStep) {
		return {
			candidates: [],
			chosen: null,
		};
	}

	return {
		candidates: [
			{
				stepId: nextStep.id,
				score: 1.0,
				reasons: ['Next step in strict order'],
			},
		],
		chosen: nextStep.id,
	};
}

