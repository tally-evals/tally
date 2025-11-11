/**
 * Step advancement logic
 */

import type { Trajectory } from '../types.js';

/**
 * Calculate the next step index after using a step
 */
export function advanceStepIndex(
	mode: Trajectory['mode'],
	currentStepIndex: number,
	stepIndexToUse: number,
	hasStep: boolean,
	turnIndex: number
): number {
	if (mode === 'strict') {
		return currentStepIndex + 1;
	}

	// In loose mode:
	// - If we matched a step, advance to the next step after the one we used
	// - If we used the sequential step (turn 0), advance normally
	// - If no step was used (natural response), don't advance step index
	if (hasStep) {
		// Advance to the step after the one we just used
		return stepIndexToUse + 1;
	}
	if (turnIndex === 0) {
		// First turn with sequential step, advance normally
		return currentStepIndex + 1;
	}

	// If no stepToUse and turnIndex > 0, we generated a natural response
	// Don't advance currentStepIndex - let it stay where it is
	return currentStepIndex;
}

