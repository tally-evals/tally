import type { ModelMessage } from 'ai';
import type { StepTrace } from '../core/types.js';

/**
 * Derive an AI-SDK compatible message history from step traces.
 *
 * This is intentionally kept internal to trajectories so StepTrace remains
 * the canonical execution state, and "message history" is just a view.
 */
export function stepTracesToMessages(stepTraces: readonly StepTrace[]): ModelMessage[] {
	const history: ModelMessage[] = [];
	for (const trace of stepTraces) {
		history.push(trace.userMessage);
		history.push(...trace.agentMessages);
	}
	return history;
}

