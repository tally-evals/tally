/**
 * Satisfaction helper - determines if a step is satisfied
 */

import type { StepDefinition, StepRuntimeState, SatisfactionContext } from '../steps/types.js';
import type { StepTrace } from '../types.js';

/**
 * Default satisfaction heuristic: check if user responded to assistant's question
 */
function defaultSatisfactionHeuristic(
	step: StepDefinition,
	stepTraces: readonly StepTrace[]
): boolean {
	// StepTrace-first heuristic:
	// If we have at least two traces, treat the newest user message as a response
	// to the previous trace's assistant output.
	if (stepTraces.length < 2) return false;
	const lastTrace = stepTraces[stepTraces.length - 1];
	const prevTrace = stepTraces[stepTraces.length - 2];
	if (!lastTrace || !prevTrace) return false;

	const prevHasAssistant = prevTrace.agentMessages.some((m) => m.role === 'assistant');
	if (!prevHasAssistant) return false;

	const contentStr =
		typeof lastTrace.userMessage.content === 'string' ? lastTrace.userMessage.content : '';

	// Light relevance check using step content (ensures 'step' is meaningfully read)
	const instructionHints = [
		...(step.hints ?? []),
		...step.instruction
			.split(/\W+/)
			.filter((t) => t.length > 4)
			.slice(0, 5),
	].map((t) => t.toLowerCase());
	const mentionsKeyword =
		contentStr.length > 0 &&
		instructionHints.some((kw) => contentStr.toLowerCase().includes(kw));

	if (contentStr.trim().length > 0 || mentionsKeyword) {
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
	stepTraces: readonly StepTrace[],
	snapshot: {
		satisfied: Set<string>;
		attemptsByStep: Map<string, number>;
	}
): Promise<boolean> {
	// Use custom isSatisfied if provided
	if (step.isSatisfied) {
		const context: SatisfactionContext = {
			stepTraces,
			snapshot,
			step,
			state,
		};
		return await step.isSatisfied(context);
	}

	// Fall back to default heuristic
	return defaultSatisfactionHeuristic(step, stepTraces);
}

