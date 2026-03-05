/**
 * Agent invocation and message parsing
 */

import type { AgentHandle } from '../types.js';
import type { ModelMessage } from 'ai';

export interface AgentInvocationResult {
	assistantMessages: ModelMessage[];
	allMessages: ModelMessage[];
}

/**
 * Invoke agent and parse response messages
 */
export async function invokeAgent(
	agent: AgentHandle,
	history: readonly ModelMessage[]
): Promise<AgentInvocationResult> {
	const agentResult = await agent.respond(history);

	// Separate assistant messages from other messages
	const assistantMessages: ModelMessage[] = [];

	for (const msg of agentResult.messages) {
		if (msg.role === 'assistant') {
			assistantMessages.push(msg);
		}
	}

	return {
		assistantMessages,
		allMessages: [...agentResult.messages],
	};
}

