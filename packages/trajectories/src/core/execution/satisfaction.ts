/**
 * Satisfaction helper - determines if a step is satisfied
 */

import type { StepDefinition, StepRuntimeState, SatisfactionContext } from '../steps/types.js';
import type { ModelMessage } from 'ai';

/**
 * Default satisfaction heuristic: check if user responded to assistant's question
 */
function defaultSatisfactionHeuristic(
	step: StepDefinition,
	history: readonly ModelMessage[]
): boolean {
	// Find last assistant message
	const lastAssistant = [...history]
		.reverse()
		.find((msg) => msg.role === 'assistant');

	if (!lastAssistant) {
		return false;
	}

	// Find last user message after assistant
	const lastUserIndex = history.findIndex(
		(msg, idx) =>
			msg.role === 'user' &&
			idx > history.indexOf(lastAssistant)
	);

	if (lastUserIndex === -1) {
		return false;
	}

	const lastUser = history[lastUserIndex];
	if (typeof lastUser.content === 'string' && lastUser.content.trim().length > 0) {
		return true;
	}

	return false;
}

/**
 * Evaluate if a step is satisfied
 */
export async function evaluateSatisfaction(
	step: StepDefinition,
	state: StepRuntimeState,
	history: readonly ModelMessage[],
	snapshot: {
		satisfied: Set<string>;
		attemptsByStep: Map<string, number>;
	}
): Promise<boolean> {
	// Use custom isSatisfied if provided
	if (step.isSatisfied) {
		const context: SatisfactionContext = {
			history,
			snapshot,
			step,
			state,
		};
		return await step.isSatisfied(context);
	}

	// Fall back to default heuristic
	return defaultSatisfactionHeuristic(step, history);
}

