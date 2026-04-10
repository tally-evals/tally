/**
 * Agent invocation and message parsing
 */

import type { AgentHandle, AgentResponse } from '../types.js';
import type { ModelMessage } from 'ai';
import type { HILToolCall } from '../hil/types.js';

export interface AgentInvocationResult {
	assistantMessages: ModelMessage[];
	allMessages: ModelMessage[];
	/** Pending HIL tool calls detected by the framework wrapper */
	pendingToolCalls: readonly HILToolCall[];
}

/**
 * Invoke agent and parse response messages
 */
export async function invokeAgent(
	agent: AgentHandle,
	history: readonly ModelMessage[]
): Promise<AgentInvocationResult> {
	const agentResult: AgentResponse = await agent.respond(history);

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
		pendingToolCalls: agentResult.pendingToolCalls,
	};
}

